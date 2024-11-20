import SyntheticButton from "@/components/form/SyntheticButton"
import { useState, useEffect, useMemo } from "react"
import { formatCents } from "@/utils/money"
import Loading from "@/components/Loading/Loading"
import { loadStripe } from "@stripe/stripe-js"
import Modal from "@/components/Modal/Modal"
import EnterCode from "@/components/EnterCode/EnterCode"
import { useRouter } from "next/router"
import Link from "next/link"
import { Auth } from "@/auth/auth"
import { ALLOW_SUBSCRIPTION } from "@/config/config"

const stripePromise = ALLOW_SUBSCRIPTION ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) : async ()=>{return ""};  // Replace with your Stripe public key

export default function PurchaseButton({ groupManifest }) {
    const [product, setProduct] = useState({})
    const [productLoadingState, setProductLoadingState] = useState(0)
    const [enterCodeIsOpen, setEnterCodeIsOpen] = useState(false)
    const [sendToStripeLoadingState, setSendToStripeLoadingState] = useState(0)
    const [discount, setDiscount] = useState(undefined)
    const router = useRouter()
    const { getToken } = Auth.useAuth()

    async function sendToStripe(){
        const stripe = await stripePromise;
        try {
            setSendToStripeLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/pay/create-checkout-session"
            const data = {'product_id': groupManifest.product_id, 'addl_data': {'group_id': groupManifest.id}}
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
                console.log(myJson)
                throw Error("Response was not success")
            }
            setSendToStripeLoadingState(2)
            let checkoutId = myJson['id']
            const { error } = await stripe.redirectToCheckout({
                sessionId: checkoutId,
            });
            if (error) {
                throw Error("Redirection to stripe failed; session id was " + checkoutId)
            }
        }
        catch (e) {
            console.log(e)
            setSendToStripeLoadingState(3)
        }
    }

    async function getProduct(){
        try {
            setProductLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/pay/product?id=${groupManifest.product_id}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            setDiscount(myJson['discount'])
            setProduct(myJson['result'])
            setProductLoadingState(2)
        }
        catch(e) {
            console.log(e)
            setProductLoadingState(3)
        }
    }

    useEffect(() => {
        getProduct()
    }, [groupManifest])

    const currentUrl = `${router.asPath}`;

    const price = useMemo(() => {
        if (product?.def_price_usd_cents){
            if (discount?.new_price_cents){
                return formatCents(discount.new_price_cents)
            }
            else {
                return formatCents(product.def_price_usd_cents)
            }
        }
        return ""
    }, [product, discount])

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '5px', 'alignItems': 'center'}}>
            <Auth.SignedOut>
                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                    <Link href={`/sign-up?redirect_url=${currentUrl}`}>
                        <SyntheticButton
                            value={"Register"}
                        />
                    </Link>
                    <Link href={`${Auth.getSignInURL(currentUrl)}`}>
                        <SyntheticButton
                            value={"Sign In"}
                        />
                    </Link>
                </div>
                <div style={{'fontSize': '.8rem', 'opacity': '.5'}}>
                    {productLoadingState == 2 ? `Then purchase for ${price}` : ""}
                </div>
            </Auth.SignedOut>
            <Auth.SignedIn>
                <SyntheticButton
                    value={(productLoadingState == 2 && sendToStripeLoadingState != 1 ? `Purchase for ${price}` : <Loading color="var(--light-text)" />)}
                    onClick={() => sendToStripe()}
                />
                <div className="_touchableOpacity" style={{'fontSize': '.7rem'}} onClick={() => setEnterCodeIsOpen(true)}>
                    Or Enter Code
                </div>
                <Modal isOpen={enterCodeIsOpen} title={"Enter Code"} close={() => {setEnterCodeIsOpen(false); router.reload()}}>
                    <div style={{'display': 'flex', 'justifyContent': 'center', 'textAlign': 'center'}}>
                        <EnterCode style={{'alignItems': 'center'}} />
                    </div>
                </Modal>
            </Auth.SignedIn>
        </div>
    )
}
