import ReactMarkdown from 'react-markdown'
import styles from './Markdown.module.css'
import remarkGfm from 'remark-gfm'
import hljs from 'highlight.js'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useState } from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import remarkMath from 'remark-math';
import CopyButton from '../CopyButton/CopyButton';
import { useMemo } from 'react';
import React from 'react';
import Tooltip from '../Tooltip/Tooltip';
import shortenText from '@/utils/text';

export default function MarkdownViewer({ children, className, onCitationClick, noPadding=false, style={}, ...props }){
    const preProcessedContent = preprocessMathNotation(children);

    // We wrap components with <CustomText /> in order to add citation functionality
    const wrappedComponents = useMemo(() => {
        const componentsToWrap = ['p', 'li', 'span', 'strong', 'em', 'a', 'td', 'th', 'blockquote'];
        return componentsToWrap.reduce((acc, component) => {
            acc[component] = withCustomText(component, onCitationClick);
            return acc;
        }, {});
    }, [onCitationClick])

    const components = useMemo(() => ({
        code({node, className, children, ...props}) {
            //const match = /language-(\w+)/.exec(className || '')
            let language;
            const match = /language-(\w+)/.exec(className || '');
            if (match) {
                language = match[1];
            }
            else {
                const detectedLanguage = hljs.highlightAuto(String(children)).language;
                language = detectedLanguage || 'plaintext'; // Default to plaintext if undetected
            }

            const text = String(children)
            const inline = !text.includes('\n') && !(text.length > 50)

            if (className && className.includes('math')) {
                return inline ? (
                    <InlineMath math={text} />
                ) : (
                    <BlockMath math={text} />
                );
            }

            return !inline ? (
                <div style={{'display': 'flex', 'flexDirection': 'column', 'marginTop': '10px', 'marginBottom': '10px', 'borderRadius': 'var(--medium-border-radius)', 'overflow': 'hidden'}}>
                    <pre>
                        <div className={styles.codeCopy}>
                            <div style={{'flex': '1'}}></div>
                            <div>
                                {language}
                            </div>
                            <CopyButton noTooltip={true} noFlicker={true} text={"Copy"} iconSize={17} textToCopy={text} />
                        </div>
                    </pre>
                    <SyntaxHighlighter style={tomorrow} language={language} PreTag="pre" {...props}>
                        {text.replace(/\n$/, '')}
                    </SyntaxHighlighter>
                </div>
            ) : (
                <code className={className} {...props}>
                    {text}
                </code>
            )
        },
        // Custom component for block math
        math: ({ value }) => <BlockMath math={value} />,
        // Custom component for inline math
        inlineMath: ({ value }) => <InlineMath math={value} />,
        // Custom citation component
        ...wrappedComponents,
        text: ({ children }) => <CustomText onCitationClick={onCitationClick}>{children}</CustomText>,
    }), [onCitationClick])
    return (
        <div className={`${styles.article} ${className}`} style={{'padding': '20px 0px', ...style}} {...props}>
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} components={components} children={preProcessedContent}/>
        </div>
    )
}

function preprocessMathNotation(content) {
    const processDollar = escapeNonMathDollarSigns(content);

    // Replace block math notation \[ ... \] with $$ ... $$
    const blockMathRegex = /\\\[(.*?)\\\]/gs;
    const processedBlockMath = processDollar.replace(blockMathRegex, (_, equation) => `$$${equation}$$`);

    // Replace inline math notation \( ... \) with $ ... $
    const inlineMathRegex = /\\\((.*?)\\\)/gs;
    const processedInlineMath = processedBlockMath.replace(inlineMathRegex, (_, equation) => `$${equation}$`);

    return processedInlineMath;
}

function escapeNonMathDollarSigns(content) {
    const potentialMathRegex = /\$(.+?)\$/gs;

    function isLikelyDollarExpression(expression) {
        // Matches expressions like $350 or $5b to avoid triggering latex on things that are obviously money related.
        // Also tries to account for bolded numbers, like **1,234**.
        return /^\$?\d+(?:\.\d+)?(?:[kmbt])?(?:[.,;:\s]|$)/i.test(expression) && /[\s,\n,(,[]\**$/.test(expression);
    }

    let lastIndex = 0;
    let result = '';

    content.replace(potentialMathRegex, (match, inner, offset) => {
        result += content.slice(lastIndex, offset);
        if (isLikelyDollarExpression(inner)) {
            result += `\\$${inner}\\$`;
        } 
        else {
            result += `$${inner}$`;
        }
        lastIndex = offset + match.length;
    })
    result += content.slice(lastIndex)
    return result
}

const withCustomText = (WrappedComponent, onCitationClick, viewerElement) => {
    return ({ children, ...props }) => (
        <WrappedComponent {...props}>
            <CustomText onCitationClick={onCitationClick} viewerElement={viewerElement} >
                {children}
            </CustomText>
        </WrappedComponent>
    );
};

// Custom text parses for citations
const CustomText = ({ children, viewerElement, onCitationClick }) => {
    if (typeof children === 'string') {
        const regex = /(\\cit\{[^}]+\} ?\{[^}]+\})/;
        const parts = children.split(regex);
        // Using two separate parts so that we can remove the spaces before the citation.
        const withMatch = parts.map((part) => {
            const match = part.match(/\\cit\{([^}]+)\} ?\{([^}]+)\}/);
            return [part, match]
        })
        return withMatch.map(([part, match], index) => {
            if (match) {
                const [_, arg1, arg2] = match;
                return <Citation key={index} text={arg2} tooltip={arg1} onClick={onCitationClick} viewerElement={viewerElement} />;
            }
            if (index + 1 < withMatch.length){
                const [_, nextMatch] = withMatch[index + 1]
                if (nextMatch){
                    return part.replace(/\s+$/, '')  // remove trailing space
                }
            }
            return part;
        });
    }
  
    if (Array.isArray(children)) {
        return children.map((child, index) => {
            if (typeof child === 'string') {
                return <CustomText key={index} onCitationClick={onCitationClick} viewerElement={viewerElement}>{child}</CustomText>;
            }
            if (React.isValidElement(child)) {
                return child
            }
            return child;
        });
    }
  
    return children;
};

const Citation = ({ text, tooltip, viewerElement, onClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const shortenedText = shortenText(tooltip, 20, 150, true).replace("page", "Page");
    const fullText = tooltip.replace("page", "Page");
    
    let realMinWidth = '100px';
    if (shortenedText?.length > 100) {
        realMinWidth = '175px';
    } else if (shortenedText?.length > 50) {
        realMinWidth = '150px';
    }

    const handleClick = () => {
        if (shortenedText !== fullText) {
            setIsExpanded(!isExpanded);
        }
        if (onClick) {
            onClick(tooltip);
        }
    };

    return (
        <Tooltip 
            tooltipStyle={{ 'minWidth': `${realMinWidth}`, 'lineHeight': '.9rem', 'fontSize': '.7rem' }} 
            containerStyle={{ 'display': 'inline' }} 
            content={isExpanded ? fullText : shortenedText}
        >
            <span 
                onClick={handleClick} 
                style={{ 'fontSize': '.85rem', 'position': 'relative', 'top': '-5px', 'margin': '3px', 'color': 'var(--dark-pop-text)', 'textDecoration': 'underline' }}
            >
                {text}
            </span>
        </Tooltip>
    );
};

