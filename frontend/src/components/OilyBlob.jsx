import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * OilyBlob — gooey metaball oil orb.
 *
 * Props (all optional):
 *   color         orb tint                        default "#ffbf5e"
 *   dropletColor  tint of the dragged droplets    default = color
 *   opacity       see-through-ness of the center  default 0.6   (0 clear … 1 solid)
 *   orbScale      orb size on screen              default 1     (1.3 = bigger)
 *   dropletScale  size of the dragged droplets    default 1     (1.6 = fatter)
 *   gooeyness     how stretchy/sticky the neck is default 0.5   (0.8 = stringier)
 *   className     passed to the wrapper div
 *
 * Requires three:  npm i three
 */
export default function OilyBlob({
    className,
    color = "#ffbf5e",
    dropletColor,
    opacity = 0.6,
    orbScale = 1,
    dropletScale = 1,
    gooeyness = 0.5,
    liveliness = 1,
}) {
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const isMobile = window.innerWidth < 768;
        let width = mount.clientWidth || window.innerWidth;
        let height = mount.clientHeight || window.innerHeight;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.75));
        renderer.setSize(width, height);
        renderer.toneMapping = THREE.NoToneMapping;
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const NODES = 4;
        const VIEW_HALF = 2.4;          // world half-height (smaller = orb fills more screen)
        const ORB_R = 1.15 * orbScale;
        const BASE_RAD = [0.5, 0.44, 0.38, 0.32]; // relative bead sizes (head -> tail)

        const orbCol = new THREE.Color(color);
        const dropCol = new THREE.Color(dropletColor ?? color);
        const nodePos = Array.from({ length: NODES }, () => new THREE.Vector3());
        const nodeRad = BASE_RAD.map((r) => r * dropletScale);

        const uniforms = {
            uAspect: { value: width / height },
            uViewHalf: { value: VIEW_HALF },
            uColor: { value: orbCol },
            uDropletColor: { value: dropCol },
            uOpacity: { value: opacity },
            uOrbR: { value: ORB_R },
            uK: { value: gooeyness },
            uNodes: { value: nodePos },
            uNodeR: { value: nodeRad },
            uSteps: { value: isMobile ? 100 : 200 },
            uTime: { value: 0 },
            uLive: { value: liveliness },
        };

        const fragment = `
            precision highp float;
            #define NODES ${NODES}
            varying vec2 vUv;
            uniform float uAspect, uViewHalf, uOpacity, uOrbR, uK, uSteps;
            uniform float uTime, uLive;
            uniform vec3  uColor, uDropletColor;
            uniform vec3  uNodes[NODES];
            uniform float uNodeR[NODES];

            float smin(float a, float b, float k){
                float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
                return mix(b, a, h) - k*h*(1.0-h);
            }
            float sdSphere(vec3 p, vec3 c, float r){ return length(p-c) - r; }

            // flowing surface ripple (perturbs the normal, not the shape)
            vec3 ripple(vec3 p){
                float t = uTime;
                float a = sin(p.x*4.0 + t*1.3) * cos(p.y*3.5 - t*1.1);
                float b = sin(p.y*5.0 - t*0.9) * cos(p.z*4.2 + t*1.4);
                float c = sin(p.z*4.5 + t*1.0) * cos(p.x*3.8 - t*1.2);
                return vec3(a, b, c);
            }
            vec3 rotateY(vec3 v, float a){
                float s = sin(a), c = cos(a);
                return vec3(c*v.x + s*v.z, v.y, -s*v.x + c*v.z);
            }

            float map(vec3 p){
                float orbR = uOrbR * (1.0 + 0.02*sin(uTime*0.7)*uLive);
                float d = sdSphere(p, vec3(0.0), orbR);
                for(int i=0;i<NODES;i++) d = smin(d, sdSphere(p, uNodes[i], uNodeR[i]), uK);
                return d;
            }
            vec3 calcNormal(vec3 p){
                vec2 e = vec2(0.0015, 0.0);
                return normalize(vec3(
                    map(p+e.xyy)-map(p-e.xyy),
                    map(p+e.yxy)-map(p-e.yxy),
                    map(p+e.yyx)-map(p-e.yyx)));
            }
            vec3 env(vec3 d){
                float y = d.y*0.5 + 3.5;
                vec3 base = mix(vec3(0.30,0.24,0.16), vec3(1.0,0.96,0.88), y);
                base += pow(max(dot(d, normalize(vec3(0.5,0.7,0.5))),0.0), 366.0) * vec3(1.0,0.95,0.85)*3.6;
                base += pow(max(dot(d, normalize(vec3(-0.6,0.2,0.6))),0.0), 170.0) * vec3(0.85,0.92,1.0)*7.1;
                return base;
            }

            void main(){
                vec2 sp = (vUv*2.0 - 1.0); sp.x *= uAspect;
                vec3 ro = vec3(sp*uViewHalf, 5.0);
                vec3 rd = vec3(0.0, 0.0, -1.0);

                float t = 3.0, d = 1.0; bool hit = false;
                int steps = int(uSteps);
                for(int i=0;i<128;i++){
                    if(i>=steps) break;
                    d = map(ro + rd*t);
                    if(d < 0.0002){ hit = true; break; }
                    t += d;
                    if(t > 7.0) break;
                }
                float cov = hit ? 1.0 : (1.0 - smoothstep(0.0, 0.02, d));
                if(cov <= 0.001) discard;

                vec3 p = ro + rd*t;
                vec3 n = calcNormal(p);
                n = normalize(n + ripple(p) * (0.06 * uLive));   // living oily shimmer
                vec3 refl = reflect(rd, n);
                refl = rotateY(refl, uTime * 0.18 * uLive);       // reflections drift -> reads 3D
                float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.4);

                // tint shifts toward the droplet color near the beads
                float infl = 0.0;
                for(int i=0;i<NODES;i++)
                    infl = max(infl, smoothstep(uNodeR[i]*2.2, 0.0, length(p - uNodes[i])));
                vec3 tint = mix(uColor, uDropletColor, infl);

                vec3 e = env(refl);
                vec3 c = tint * (0.35 + 0.75*e);
                c = mix(c, e, fres*0.85);
                c += pow(max(dot(refl, normalize(vec3(0.5,0.7,0.5))),0.0), 90.0) * 2.2;

                c = c / (1.0 + c*0.5);
                c = pow(clamp(c, 0.0, 1.0), vec3(1.0/2.2));

                float alpha = mix(uOpacity*0.5, 1.0, fres) * cov;
                gl_FragColor = vec4(c, alpha);
            }
        `;

        const mat = new THREE.ShaderMaterial({
            uniforms,
            transparent: true,
            depthWrite: false,
            vertexShader: `
                varying vec2 vUv;
                void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
            `,
            fragmentShader: fragment,
        });

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
        scene.add(quad);

        // ---- pointer --------------------------------------------------------
        // Tracked on window (not the canvas) so the goo keeps following even
        // when the cursor is over the navbar / other overlays that sit on top.
        // The canvas itself ignores pointer events, so nav hovers & clicks work.
        renderer.domElement.style.pointerEvents = "none";

        let pointerX = 0, pointerY = 0, inside = false, moved = false;
        const cursor = new THREE.Vector3();
        const origin = new THREE.Vector3();

        function onMove(e) {
            const r = renderer.domElement.getBoundingClientRect();
            pointerX = ((e.clientX - r.left) / r.width) * 2 - 1;
            pointerY = -(((e.clientY - r.top) / r.height) * 2 - 1);
            // "engaged" = cursor is within the canvas area, regardless of what
            // element is on top of it
            inside =
                e.clientX >= r.left && e.clientX <= r.right &&
                e.clientY >= r.top && e.clientY <= r.bottom;
            moved = true;
        }
        function onLeaveWindow() { inside = false; }
        window.addEventListener("pointermove", onMove);
        window.addEventListener("blur", onLeaveWindow);
        document.addEventListener("mouseleave", onLeaveWindow);

        const ro = new ResizeObserver(() => {
            width = mount.clientWidth; height = mount.clientHeight;
            if (!width || !height) return;
            renderer.setSize(width, height);
            uniforms.uAspect.value = width / height;
        });
        ro.observe(mount);

        // ---- loop -----------------------------------------------------------
        const clock = new THREE.Clock();
        let raf;
        const rates = [13, 12, 11, 10]; // head fast, tail laggy -> stretchy chain

        function animate() {
            raf = requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.05);
            uniforms.uTime.value += dt;

            const engaged = inside && moved;
            cursor.set(pointerX * uniforms.uAspect.value, pointerY, 0).multiplyScalar(VIEW_HALF);
            const target = engaged ? cursor : origin;

            nodePos[0].lerp(target, 1 - Math.exp(-dt * rates[0]));
            for (let i = 1; i < NODES; i++)
                nodePos[i].lerp(nodePos[i - 1], 1 - Math.exp(-dt * rates[i]));

            renderer.render(scene, camera);
        }
        animate();

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("blur", onLeaveWindow);
            document.removeEventListener("mouseleave", onLeaveWindow);
            quad.geometry.dispose();
            mat.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        };
    }, [color, dropletColor, opacity, orbScale, dropletScale, gooeyness, liveliness]);

    return <div ref={mountRef} className={className} />;
}
