
def guess_answer_prompt(question):
    return f"""
The following is a question posed by a user about a document. Please give 3 hypothetical answers to the question.
It is OK if you do not have the information to give the answer; it is used only for semantic search purposes.
Your answer should strive to guess the form that the answer might take in the document. 
It is important that the answers are varied and different.
You must give your answers as a JSON formatted list, i.e., ["Hypothetical answer 1", "Hypothetical answer 2"]

For example, the question "In what year was the painting made?" might yield a response of ["The painting was made in 2014", "Year made: 1902", "It was painted in 1887, during the era of impressionism."].

User question: {question}
"""


def guess_answer_prompt_backup(question):
    return  f"""
The following is a question posed by a user about a document. Please give a couple plausible answers to the question.
Your answer should strive to guess the form that the answer might take in the document; it does not need to be correct, since you do not have access to the document.
Your responses will be used to perform a sematic search, not give the user an answer. 
You must give your answers as a JSON formatted list, i.e., ["Hypothetical answer 1", "Hypothetical answer 2"].
**IT IS VERY IMPORTANT THAT YOUR ANSWER INCLUDE THE JSON STRING AND NOTHING ELSE**

As an example, the question "In what year was the painting made?" might yield a response of ["The painting was made in 2014", "Year made: 1902", "Painted in 1857"].

User question: {question}
"""
