import ControlledInputText from "../form/ControlledInputText"
import Info from "../Info/Info"
import Loading from "../Loading/Loading"
import Button from "../form/Button"
import { useEffect, useState } from "react"
import { Auth } from "@/auth/auth"

export default function EnterCode({ showPreviouslyUsedCodes=false, style, ...props }) {

    const [userCodeText, setUserCodeText] = useState("")
    const [userCodeLoadingState, setUserCodeLoadingState] = useState(0)
    const [userCodeMessage, setUserCodeMessage] = useState("")

    const [getUserCodesLoadState, setGetUserCodesLoadState] = useState(0)
    const [existingUserCodes, setExistingUserCodes] = useState([])

    const { getToken, isSignedIn } = Auth.useAuth()

    async function enterCode(){
        try {
            setUserCodeLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/user/validate-code`
            const data = {
                'code': userCodeText
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST',
                'body': JSON.stringify(data)
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                setUserCodeMessage(myJson['reason'])
                setUserCodeLoadingState(3)
            }
            else {
                setUserCodeMessage(myJson['for'])
                setUserCodeLoadingState(2)
            }
        }
        catch(e) {
            console.log(e)
            setUserCodeLoadingState(3)
        }
    }

    async function getUserCodes(){
        try {
            setGetUserCodesLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/user/codes`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            setExistingUserCodes({'productCodes': myJson['product_codes'], 'productsDict': myJson['products_dict']})
            setGetUserCodesLoadState(2)
        }
        catch(e) {
            setGetUserCodesLoadState(3)
        }
    }

    useEffect(() => {
        if (isSignedIn){
            getUserCodes()
        }
    }, [isSignedIn])

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', ...style}} {...props}>
            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                <div>
                    Enter Code
                </div>
                <Info verticalAlign="bottom" text={"For discounts and referrals"} />
            </div>
            <div style={{'width': '100%', 'maxWidth': '300px'}}>
                <ControlledInputText
                    value={userCodeText}
                    setValue={setUserCodeText}
                    allCaps={true}    
                />
            </div>
            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                {userCodeLoadingState == 1 ? (
                    <Loading />
                ) : (
                    <Button onClick={() => enterCode()} value={"Enter"} />
                )}
                {userCodeLoadingState == 3 ? (
                    userCodeMessage
                ) : (userCodeLoadingState == 2 ? (
                    <div>
                        {`Code for ${userCodeMessage} accepted!`}
                    </div>
                ) : "")}
            </div>
            {showPreviouslyUsedCodes && existingUserCodes?.productCodes?.length ? (
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                    <div>
                        Previously Used Codes:
                    </div>
                    <div style={{'display': 'flex', 'flexDirection': 'column'}}>
                        {existingUserCodes.productCodes.map((x) => {
                            return (
                                <div key={x.id}>
                                    {`Code: "${x['value']}", for ${existingUserCodes.productsDict[x['product_id']]?.name}`}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : ""}
        </div>
    )
}
