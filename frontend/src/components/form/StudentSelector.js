import { useState } from "react";
import ControlledInputText from "./ControlledInputText";
import SyntheticButton from "./SyntheticButton";
import styles from './Form.module.css'
import Image from "next/image";
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import MyImage from "../MyImage/MyImage";
import MultiInputText from "./MultiInputText";

export default function StudentSelector({ students, setStudents, ...props }){


    if (!students){
        students = []
    }

    return (
        <div>
            Add Students <br/><br/>
            <MultiInputText
                value={students.map((item) => item.email)}
                setValue={(x) => {
                    setStudents(x.map((item) => {return {'email': item}}))
                }}
                placeholder={"e.g., niels@bohr.com"}
                useLightPrimaryStyle={true} />
        </div>
    )
}
