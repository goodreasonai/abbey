import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { useState, useCallback } from 'react';
import Link from "next/link";
import styles from './AssetsTableWithQuizes.module.css';
import LoadingSkeleton from "../Loading/LoadingSkeleton";
import { HTML5Backend } from 'react-dnd-html5-backend';
import MyImage from '../MyImage/MyImage';
import QuizIcon from '../../../public/icons/QuizIcon.png'
import Tooltip from '../Tooltip/Tooltip';
import AddIcon from '../../../public/icons/AddIcon.png'
import Modal from '../Modal/Modal';
import SelectAssetWrapper from '../SelectAssetWrapper/SelectAssetWrapper';
import { toPercentage } from '@/utils/text';
import CheckIcon from '../../../public/icons/CheckIcon.png'
import CreateWrapper from '../Quick/CreateWrapper';
import Loading from '../Loading/Loading';

const ItemType = 'ASSET';

function DraggableAsset({ item, index, moveAsset, number, canEdit, canEditQuizzes, quiz, quizGrade, assignQuizCallback, nAssets, noTopStyle }) {
    
    const [, ref] = useDrag({
        type: ItemType,
        item: { index },
        canDrag: canEdit,
    });

    const [, drop] = useDrop({
        accept: ItemType,
        hover: (draggedItem) => {
            if (draggedItem.index !== index) {
                moveAsset(draggedItem.index, index)
                draggedItem.index = index;
            }
        },
    });

    let quizPercentage = quizGrade && toPercentage(quizGrade.total_points, quizGrade.available_points)

    const [newQuizLoading, setNewQuizLoading] = useState(false)

    return (
        <div ref={(node) => ref(drop(node))} key={item.id} className={`${styles.totalContainer} ${index == 0 && !noTopStyle ? styles.totalContainerTop : ""} ${index == nAssets - 1 ? styles.totalContainerBottom : ''}`} >
            <Link href={`/assets/${item.id}`} style={{'flex': '1'}}>
                <div className={`${styles.item} ${index == 0 && !noTopStyle ? styles.itemContainerTop : ""} ${index == nAssets - 1 ? styles.itemContainerBottom : ''}`}>
                    {number && (
                        <div className={styles.number}>
                            {`${index + 1}.`}
                        </div>
                    )}
                    <div className={styles.title}>
                        {item.title}
                    </div>
                    <div className={`${styles.desc} _clamped2`}>
                        {item.preview_desc}
                    </div>
                </div>
            </Link>
            {quiz ? (
                <div className={`${styles.quizContainer}`}>
                    {quizPercentage ? (
                        <Tooltip content={`${quizPercentage}%`}>
                            <Link href={`/assets/${quiz}`}>
                                <div style={{'position': 'relative'}}>
                                    <MyImage src={QuizIcon} width={20} height={20} alt={"Quiz"} />
                                    <div style={{'position': 'absolute', 'bottom': '0px', 'right': '0px', 'height': '10px', 'width': '10px', 'borderRadius': '10px', 'backgroundColor': 'var(--dark-primary)'}}>
                                        <MyImage style={{'position': 'absolute', 'top': '1px', 'left': '3px'}} src={CheckIcon} width={5} height={8} alt={"Checkmark"} />
                                    </div>
                                </div>
                            </Link>
                        </Tooltip>
                    ) : (
                        <Link href={`/assets/${quiz}`}>
                            <MyImage src={QuizIcon} width={20} height={20} alt={"Quiz"} />
                        </Link>
                    )}
                </div>
            ) : (canEditQuizzes ? (
                <div className={`${styles.quizContainer}`}>
                    <CreateWrapper
                        noShow={true}
                        templateCode={'quiz'}
                        data={{'title': `Quiz for ${item.title}`, 'preview_desc': `How well do you know ${item.title}?`, 'selections': `[${item.id}]`, 'group': item.group_id}}
                        loadCallback={() => setNewQuizLoading(true)}
                        callback={(x) => {setNewQuizLoading(false); x && assignQuizCallback(item.id, x.id)}}
                        newTab={true}
                    >
                        {newQuizLoading ? (
                            <Loading text='' />
                        ) : (
                            <MyImage  src={AddIcon} width={20} height={20} alt="Add" />
                        )}
                    </CreateWrapper>
                </div>
            ) : "")}
        </div>
    );
}

export default function AssetsTableWithQuizes({ assets, setAssets, assetsLoadState, placeholderN, number=true, canEdit=false, canEditQuizzes=undefined, quizes={}, quizGrades={}, assignQuizCallback=(x)=>{}, reorderCallback=(x)=>{}, noTopStyle=false, emptyMessage="No assets found" }) {
    const moveAsset = useCallback((dragIndex, hoverIndex) => {
        if (dragIndex === hoverIndex) {
            return;
        }
        setAssets((prev) => {
            const updatedAssets = [...prev];
            const [draggedAsset] = updatedAssets.splice(dragIndex, 1);
            updatedAssets.splice(hoverIndex, 0, draggedAsset);
            reorderCallback(updatedAssets)
            return updatedAssets
        })
    }, [setAssets]);

    return (
        <DndProvider backend={HTML5Backend}>
            <div className={styles.container}>
                {assetsLoadState !== 2 ? (
                    <LoadingSkeleton numResults={placeholderN} />
                ) : (
                    assets?.length ? assets.map((asset, index) => {
                        const quiz = quizes && quizes[asset.id]
                        const quizGrade = quiz && quizGrades[quiz]
                        return (
                            <DraggableAsset
                                key={asset.id}
                                item={asset}
                                index={index}
                                nAssets={assets?.length}
                                moveAsset={moveAsset}
                                quiz={quiz}
                                quizGrade={quizGrade}
                                assignQuizCallback={assignQuizCallback}
                                number={number}
                                noTopStyle={noTopStyle}
                                canEdit={canEdit}
                                canEditQuizzes={(canEditQuizzes === undefined && canEdit || canEditQuizzes)}
                            />
                        )
                    }) : emptyMessage
                )}
            </div>
        </DndProvider>
    );
}
