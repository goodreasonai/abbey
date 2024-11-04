import React, { useEffect, useRef, useState } from 'react';
import { Gradient } from './gradientGraphics';


function isWebGLSupported() {
    try {
        var canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch(e) {
        return false;
    }
}


export default function GradientEffect({ style, colors=['var(--dark-primary)', 'var(--logo-red)', 'var(--logo-blue)', 'var(--dark-highlight)'] }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!isWebGLSupported()){
            console.log("Web GL not supported; cannot use GradientEffect.")
            return
        }
        if (canvasRef.current){
            const gradient = new Gradient();
            gradient.initGradient(canvasRef.current);
            return () => {
                gradient.disconnect();
            };
        }
    }, [canvasRef.current]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                'position': 'absolute',
                'top': '0px',
                'left': '0px',
                'bottom': '0px',
                'right': '0px',
                'backgroundColor': 'var(--dark-primary)',  /* For error fallback */
                ...style,
                '--gradient-color-1': colors[0],
                '--gradient-color-2': colors[1],
                '--gradient-color-3': colors[2],
                '--gradient-color-4': colors[3],
            }}
        />
    );
};
