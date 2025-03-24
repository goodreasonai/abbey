import MarkdownViewer from "../Markdown/MarkdownViewer";
import MyImage from "../MyImage/MyImage";
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import { useEffect, useState } from "react";

export default function AlertBanner({}) {

    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const alertDismissed = localStorage.getItem('alertDismissed');
        if (alertDismissed) {
            const dismissedTime = JSON.parse(alertDismissed);
            const isExpired = new Date().getTime() > dismissedTime + 48 * 60 * 60 * 1000;
            if (!isExpired) {
                setIsVisible(false);
                return;
            }
        }
        setIsVisible(true);
    }, []);
    
    const dismissAlert = () => {
        localStorage.setItem('alertDismissed', JSON.stringify(new Date().getTime()));
        setIsVisible(false);
    };

    const text = process.env.NEXT_PUBLIC_ALERT
    
    if (!isVisible || !text) return "";
    return (
        <div style={{'backgroundColor': 'var(--dark-primary)', 'color': 'var(--light-text)', 'padding': '5px', 'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
            <MarkdownViewer style={{'padding': '0px', 'fontSize': '11pt', 'flex': '1', 'textAlign': 'center'}}>
                {text}
            </MarkdownViewer>
            <MyImage onClick={() => dismissAlert()} src={RemoveIcon} width={20} height={20} className="_clickable" />
        </div>
    )
}
