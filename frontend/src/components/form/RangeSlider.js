import styles from './Form.module.css'

export default function RangeSlider({ min = 0, max = 100, value, onChange, ...props }) {
    return (
      <div className={styles.rangeSliderContainer} {...props}>
        <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={styles.rangeSlider}
        />
      </div>
    );
};
  
