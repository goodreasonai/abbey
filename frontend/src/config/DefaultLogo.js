import MyImage from "@/components/MyImage/MyImage";

/*

This component appears in the top left of the NavBar

*/

export default function DefaultLogo({ mainImage, mainText }) {

    return (
        <div style={{'display': 'flex', 'gap': '7px', 'alignItems': 'center'}}>
            <div style={{'fontSize': '13pt', 'fontFamily': 'var(--font-logo)'}}>
                {mainText}
            </div>
            <MyImage unoptimized={true} alt={"Logo"} src={mainImage} height={20} canSwitch={false} priority={true} />
        </div>
    )

}
