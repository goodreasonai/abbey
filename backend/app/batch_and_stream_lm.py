import sys
from flask import Response
import json
import random
from .configs.str_constants import DIVIDER_TEXT, CHAT_ERROR_TEXT
import concurrent.futures
import time
import queue
from .integrations.lm import LM, LM_PROVIDERS, DEFAULT_CHAT_MODEL

"""

This is designed to simply call the lm function in a multi-threaded way, no matter the function
There are usually ways to give batched calls directly to the API, but this should be easier for now.

These functions do NOT do any streaming.

"""

# Used by batched_lm and stream_progress_batched_lm
def _batched_lm_worker(data, index, lm: LM, system_prompt, delay=None, make_json=False):
    """Thread worker function"""
    # Delay before starting the function
    if not delay:
        # Random delay so that if a bunch of batches go out quickly, they plausibly happen at different times.
        delay = random.random() / 3  # between 0 and .33 seconds.
    time.sleep(delay)    
    # Call the target function
    return lm.run(data, system_prompt=system_prompt, make_json=make_json), index


"""

Here, we submit data in parallel to the LMs and yield text after each is completed in a streaming fashion.

**The language model itself is not streaming - it's just that it will yield the full text after each job is complete **

Yields tuples of result, index pairs

"""

# data_list can be a generator
def stream_batched_lm(data_list, max_threads=10, system_prompt=None, lm: LM=LM_PROVIDERS[DEFAULT_CHAT_MODEL], make_json=False):
        
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_threads) as executor:

        futures = [executor.submit(_batched_lm_worker, data, index, lm, system_prompt=system_prompt, make_json=make_json) for index, data in enumerate(data_list)]
        
        for future in concurrent.futures.as_completed(futures):
            result, index = future.result()
            yield result, index

"""

Here, we submit data in parallel to the LMs and yield an index (but not the text) when complete.

**The language model itself is not streaming - it's just that it will yield an index after each job is complete **

This function uses a streaming callback to store its work - usually a database entry - does NOT return llm results.

"""

def stream_progress_batched_lm(data_list, get_lm_part=lambda x:x, get_sys_part=lambda x:None, streamingCallback=None, max_threads=10, lm: LM=LM_PROVIDERS[DEFAULT_CHAT_MODEL], mini_batch_size=20):

    # mini batches to avoid putting all of data_list in memory
    def batch_effect(mini_batch):
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_threads) as executor:
            futures = [executor.submit(_batched_lm_worker, get_lm_part(data), index+offset, lm, system_prompt=get_sys_part(data)) for index, data in enumerate(mini_batch)]

            for future in concurrent.futures.as_completed(futures):
                result, index = future.result()
                if streamingCallback:
                    streamingCallback(result, index, mini_batch[index-offset])
                yield index

    mini_batch = []
    offset = 0
    for data in data_list:
        mini_batch.append(data)
        if len(mini_batch) < mini_batch_size:
            continue

        for effect in batch_effect(mini_batch):
            yield effect
        mini_batch = []
        offset += mini_batch_size
    
    if len(mini_batch) > 0:
        for effect in batch_effect(mini_batch):
            yield effect

# Returns response - generator yielding comma separated index values.
def stream_progress_batched_lm_resp(*args, **kwargs):
    def resp():
        for i in stream_progress_batched_lm(*args, **kwargs):
            yield f"{i},"

    return Response(resp(), mimetype='text/event-stream')


"""

The streaming-lm_resp function returns a Flask response rather than just text
The first response is guaranteed to be JSON with any keyword arguments passed to it
Then it yields plaintext until finished.

"""

def _threaded_stream_lm(q, prompt, _index=0, stream_lm: LM=LM_PROVIDERS[DEFAULT_CHAT_MODEL], **prompt_kwargs):
    q: queue.Queue

    system_prompt = None
    if 'system_prompt' in prompt_kwargs:
        system_prompt = prompt_kwargs['system_prompt']
        del prompt_kwargs['system_prompt']
    
    context = []
    if 'context' in prompt_kwargs:
        context = prompt_kwargs['context']
        del prompt_kwargs['context']

    extra_kwargs = {}
    if 'temperature' in prompt_kwargs:
        extra_kwargs['temperature'] = prompt_kwargs['temperature']
        del prompt_kwargs['temperature']

    if 'images' in prompt_kwargs:
        extra_kwargs['images'] = prompt_kwargs['images']
        del prompt_kwargs['images']

    # Send only the remaining kwargs (includes sources)
    q.put((_index, json.dumps(prompt_kwargs)))

    try:
        for stream_resp in stream_lm.stream(prompt, system_prompt=system_prompt, context=context, **extra_kwargs):
            q.put((_index, stream_resp.text))
    except Exception as e:
        print(f"Chat LM exception: {e}", file=sys.stderr)
        q.put((_index, CHAT_ERROR_TEXT))
    q.put((-1, ''))


# True multiplexed streaming LM
# Used for getting question by question, token by token streaming
# Yields strings that are JSON data with info on which partial response is for which prompt
def stream_multiplexed_batched_lm(prompts, kwargs_list=None, max_threads=20, model: LM=LM_PROVIDERS[DEFAULT_CHAT_MODEL]):
    if kwargs_list is None:
        kwargs_list = [{} for _ in prompts]

    if len(prompts) != len(kwargs_list):
        raise ValueError("Length of prompts and kwargs_list must be the same")

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_threads) as executor:

        futures = []
        i = 0

        q = queue.Queue()

        for prompt, kwargs in zip(prompts, kwargs_list):
            x = executor.submit(_threaded_stream_lm, q, prompt, stream_lm=model, _index=i, **kwargs)
            futures.append(x)
            i += 1

        ct = 0
        YIELD_BATCH_THRESHOLD = 100 if len(prompts) > 3 else 1  # in tokens
        yielding_batch = []

        had_first = {}

        def get_combined(yielding_batch):
            firsts = []
            combined = {}
            for tok in yielding_batch:
                if tok['index'] in had_first:
                    if tok['index'] in combined:
                        combined[tok['index']] += tok['result']
                    else:
                        combined[tok['index']] = tok['result']
                else:
                    firsts.append(tok)
                    had_first[tok['index']] = True
            firsts_and_combined = [json.dumps(x) for x in firsts] + [json.dumps({'index': i, 'result': x}) for i, x in combined.items()]
            to_yield = DIVIDER_TEXT.join(firsts_and_combined) + DIVIDER_TEXT
            return to_yield

        num_timeouts = 0
        while True:
            try:
                # Might be better to make the timout dynamic, and end the loop if it times out too much
                # Similar to above, might also be good to make this a function of the number of threads (# of threads still active?)
                index, chunk = q.get(timeout=.05)
                if index == -1:
                    ct += 1
                    if ct >= len(futures):
                        break
                else:
                    yielding_batch.append({"index": index, "result": chunk})
                    if len(yielding_batch) > YIELD_BATCH_THRESHOLD:
                        combined = get_combined(yielding_batch)
                        yield combined
                        yielding_batch = []
            except queue.Empty:
                num_timeouts += 1
                if len(yielding_batch) > 0:
                    combined = get_combined(yielding_batch)
                    yield combined
                    yielding_batch = []
        
        if yielding_batch:
            combined = get_combined(yielding_batch)
            yield combined
        
        for future in concurrent.futures.as_completed(futures):
            # Always good to waitpid
            # However - in future, should probably put some error handling stuff here.
            try:
                _ = future.result()
            except Exception as e:
                print(f"Error occurred in thread: {e}", file=sys.stderr)
