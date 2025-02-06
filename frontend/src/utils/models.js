import OpenaiLogomarkBlack from '../../public/random/OpenaiLogomarkBlack.png'
import MistralLogo from '../../public/random/MistralLogo.png'
import MetaLogo from '../../public/random/MetaLogo.png'
import AnthropicLogo from '../../public/random/Anthropic.png'
import DeepseekLogo from '../../public/random/Deepseek.png'
import GeminiLogo from '../../public/random/Gemini.png'



// returns with keys {'canSwitch', 'src', 'alt'}
export function getImageByModelName(name){
    if (!name) return {};
    if (name.includes("GPT-")){
        return {'canSwitch': true, 'src': OpenaiLogomarkBlack, 'alt': 'OpenAI'}
    }
    else if (name.includes('Mistral')){
        return {'canSwitch': false, 'src': MistralLogo, 'alt': 'Mistral AI'}
    }
    else if (name.includes('Llama')){
        return {'canSwitch': false, 'src': MetaLogo, 'alt': 'Meta AI'}
    }
    else if (name.includes('Claude')){
        return {'canSwitch': true, 'src': AnthropicLogo, 'alt': 'Anthropic'}
    }
    else if (name.includes('Deepseek')){
        return {'canSwitch': false, 'src': DeepseekLogo, 'alt': 'Deepseek'}
    }
    else if (name.includes('Gemini')){
        return {'canSwitch': false, 'src': GeminiLogo, 'alt': 'Gemini'}
    }
    return {}
}
