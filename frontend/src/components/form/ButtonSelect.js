import styles from './Form.module.css'

/*

** THIS ELEMENT IS OVERRIDDEN BY TOGGLEBUTTONS **
TODO: REMOVE

value = the state to connect to
setValue = the setter function
options = list of objects with 'element' and 'name' keys
--> element shows up inside the button, name is what the value gets set to

*/
export default function ButtonSelect({ value, setValue, options, ...props }){


    function makeOption(item, i){

        let selected = {}
        if (item.name == value){
            selected = {
                'style': {'backgroundColor': 'var(--dark-primary)', 'color': 'var(--light-text'}
            }
        }

        return (
            <div className={`${styles.buttonSelectOption}`} key={i} onClick={() => setValue(item.name)} {...selected}>
                {item.element}
            </div>
        )
    }

    return (
        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}} {...props}>
            {options.map(makeOption)}
        </div>
    )
}
