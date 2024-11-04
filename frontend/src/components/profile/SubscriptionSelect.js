import { Auth } from "@/auth/auth";
import Button from '../form/Button'
import styles from './SubscriptionSelect.module.css'
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { useState } from 'react';
import Loading from '../Loading/Loading';
import BeggingIcon from '../../../public/icons/BeggingIcon.png'
import ChurchWindowIcon from '../../../public/icons/ChurchWindowIcon.png'
import EnterpriseIcon from '../../../public/icons/EnterpriseIcon.png'
import Image from 'next/image'
import SensitiveButton from '../form/SensitiveButton';
import MyImage from '../MyImage/MyImage';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);  // Replace with your Stripe public key

export default function SubscriptionSelect({selected=undefined,  ...props}){

    const [cathedralCancelLoadState, setCathedralCancelLoadState] = useState(0)

    const { getToken } = Auth.useAuth()

    async function goToStripe(){
        const stripe = await stripePromise;

        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/pay/create-checkout-session"
            const body = {}
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST',
                'body': JSON.stringify(body)
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
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
        }
    }


    async function cancelSubscription(product_code){
        try {

            if (!product_code){
                throw Error("There was no product code")
            }
            
            setCathedralCancelLoadState(1)

            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/pay/cancel-subscription"
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST'
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            setCathedralCancelLoadState(2)
        }
        catch (e) {
            console.log(e)
            setCathedralCancelLoadState(3)
        }
    }


    function makeCard(item, i){

        let chosenOptionHeader = (
            <div className={styles.yourTier} style={{'color': 'rgba(0, 0, 0, 0)', 'backgroundColor': 'unset'}}>
                Your tier
            </div>
        )
        let realBottomContent = item.bottomContent

        if (selected === item.code){
            chosenOptionHeader = (
                <div className={styles.yourTierSelected}>
                    Your tier
                </div>
            )
            if (item.cancel){
                realBottomContent = item.cancel
            }
        }

        

        return (
            <div className={styles.fullSubCardContainer} style={{'display': 'flex', 'flexDirection': 'column'}} key={i}>
                {chosenOptionHeader}
                <div className={styles.subCardContainer}>
                    <div className={styles.subCardHeader}>
                        {item.titleSection}
                    </div>
                    <div>
                        {item.desc}
                    </div>
                    {item.middleContent}
                    {realBottomContent}
                </div>
            </div>
        )

    }

    const cards = [
        {
            'titleSection': (
                <div style={{'display': 'flex', 'gap': '10px'}}>
                    <div>
                        Novice
                    </div>
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        <MyImage src={BeggingIcon} width={20} height={20} alt={"Free"} />
                    </div>
                </div>
            ),
            'code': 'free',
            'desc': 'We offer some basic features under a free plan:',
            'middleContent': (
                <div>
                    <ul>
                        <li>The least powerful models</li>
                        <li>Basic templates, like Document and Folder</li>
                        <li>Limited uploads and creations</li>
                    </ul>
                </div>
            ),
            'bottomContent': (
                <div>
                    While you may stay in this tier indefinitely, remember: "As soon as a coin in the coffer rings, the soul from purgatory springs."
                </div>
            )
        },
        {
            'titleSection': (
                <div style={{'display': 'flex', 'gap': '10px'}}>
                    <div>
                        Cathedral
                    </div>
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        <MyImage src={ChurchWindowIcon} width={20} height={20} alt={"Cathedral"} />
                    </div>
                </div>
            ),
            'code': 'abbey-cathedral',
            'desc': 'How much would you pay to increase your IQ 10 points? Is that figure more or less than the cost of Abbey Cathedral?',
            'middleContent': (
                <div>
                    <ul>
                        <li><b>Unlimited</b> uploads and creations</li>
                        <li>Access to <b>more powerful models</b>, like GPT-4o.</li>
                        <li>Access to better <b>text-to-speech</b> models</li>
                    </ul>
                </div>
            ),
            'bottomContent': (
                <>
                    <div>
                        Price: $9 per month.
                    </div>
                    <div>
                        <Button value={"Upgrade"} onClick={goToStripe} />
                    </div>
                </>
            ),
            'cancel': (
                <div>
                    {
                        cathedralCancelLoadState == 0 ? (
                            <SensitiveButton value="Cancel" sensitiveText='Confirm Cancel' onClick={() => cancelSubscription('abbey-cathedral')} />
                        ) : (cathedralCancelLoadState == 1 ? (
                                <Loading text='' />
                            ) : (cathedralCancelLoadState == 2 ? (
                                    <div>
                                        Canceled
                                    </div>
                                ) : (cathedralCancelLoadState == 3 ? (
                                        <div>
                                            Error
                                        </div>
                                    ) : ""
                                )
                            )
                        )
                    }
                </div>
            )
        },
        {
            'titleSection': (
                <div style={{'display': 'flex', 'gap': '10px'}}>
                    <div>
                        Enterprise
                    </div>
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        <MyImage src={EnterpriseIcon} width={20} height={20} alt={"Enterprise"} />
                    </div>
                </div>
            ),
            'code': 'abbey-enterprise',
            'desc': (
                <div>
                    This is our tier for companies that want a full AI platform for sourced knowledge. We can offer:
                </div>
            ),
            'middleContent': (
                <div>
                    <ul>
                        <li><b>Custom</b> templates and interfaces</li>
                        <li>Unlimited document <b>size and storage</b></li>
                        <li>Support by <b>phone</b> (with a human)</li>
                        <li>On-prem or managed <b>private</b> instances</li>
                    </ul>
                </div>
            ),
            'bottomContent': (
                <div>
                    Please reach out to team@us.ai for more info.
                </div>
            )
        },
    ]


    return (
        <div className={styles.container}>
            {cards.map(makeCard)}
        </div>
    )

}
