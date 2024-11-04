import { getTemplateByCode } from "@/templates/template"
import ScrollingCards from "./ScrollingCards"
import MyImage from "../MyImage/MyImage"

// cardTemplates is a 2d list like: [['notebook', 'document'], ['website', 'video']]
export default function ScrollingCardsWithTemplates({ cardTemplates=[['notebook', 'document'], ['detached_chat', 'website'], ['video', 'text_editor']], title, paragraph, isDark, cardsStyle={} }) {

    const cardData = cardTemplates.map(([t1, t2]) => {
        return ({'id': `${t1}_${t2}`, 'content': (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'height': '100%'}}>
                <Card tmp={t1} style={{'flex': '1', ...cardsStyle}} />
                <Card tmp={t2} style={{'flex': '1', ...cardsStyle}} />
            </div>
        )})
    })
    
    return (
        <ScrollingCards cards={cardData} title={title} paragraph={paragraph} forceLightText={isDark} />
    )
}


function Card({ tmp, style, ...props }){
    const obj = getTemplateByCode(tmp)
    let title = obj.constructor.readableName
    let icon = obj.constructor.icon
    let desc = obj.constructor.description
    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '2rem', 'backgroundColor': 'var(--light-background)', 'color': 'var(--dark-text)', 'border': '1px solid var(--light-border)', 'borderRadius': 'var(--large-border-radius)', 'padding': '2rem', ...style}} {...props}>
            <div style={{'fontSize': '1.5rem', 'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                <div>
                    {title}
                </div>
                <MyImage src={icon} alt={title} width={25} height={25} />
            </div>
            <div style={{'fontSize': '1.25rem'}}>
                {desc}
            </div>
        </div>
    )
}
