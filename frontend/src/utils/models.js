import OpenaiLogomarkBlack from '../../public/random/OpenaiLogomarkBlack.png'
import MistralLogo from '../../public/random/MistralLogo.png'
import MetaLogo from '../../public/random/MetaLogo.png'
import AnthropicLogo from '../../public/random/Anthropic.png'


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
    return {}
}
