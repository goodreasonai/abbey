import { MutatingDots } from 'react-loader-spinner'


export default function BigLoading({ color="var(--dark-primary)", secondaryColor="var(--dark-highlight)" }) {
    return (
        <div>
            <MutatingDots
                visible={true}
                height={100}
                width={100}
                color={color}
                secondaryColor={secondaryColor}
                radius={12.5}
                ariaLabel="loading"
                wrapperStyle={{}}
                wrapperClass=""
            />
        </div>
    )
}
