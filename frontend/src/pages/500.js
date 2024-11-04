import DefaultPage from "@/components/DefaultPage";

export default function Custom500() {
    return (
        <DefaultPage>
            <div style={{'text-align': 'center', 'padding': '2em'}}>
                <h1>Error 500 - Something Went Wrong</h1>
            </div>
        </DefaultPage>
    )
}

