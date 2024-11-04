import styles from './Form.module.css'

export default function Checkbox({...props }) {

    return (
        <input type="checkbox" {...props} />
    );
}
