export const SIMPLEX_GLSL = /* glsl */ `
  vec3 mod289v3(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289v4(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289v4(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289v3(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

export const RAINBOW_GLSL = /* glsl */ `
  vec3 getRainbow(float t){
    t=clamp(t,0.0,1.0)*6.0;
    int i=int(floor(t));
    float f=fract(t);
    vec3 a,b;
    if(i==0)     {a=vec3(1.0,0.09,0.27);b=vec3(1.0,0.57,0.0);}
    else if(i==1){a=vec3(1.0,0.57,0.0); b=vec3(1.0,0.92,0.0);}
    else if(i==2){a=vec3(1.0,0.92,0.0); b=vec3(0.0,0.90,0.46);}
    else if(i==3){a=vec3(0.0,0.90,0.46);b=vec3(0.16,0.47,1.0);}
    else if(i==4){a=vec3(0.16,0.47,1.0);b=vec3(0.40,0.12,1.0);}
    else         {a=vec3(0.40,0.12,1.0);b=vec3(0.83,0.0,0.98);}
    return mix(a,b,f);
  }
`;

export const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vSkyDirection;
  void main() {
    vSkyDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SKY_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uMidColor;
  uniform vec3 uBottomColor;
  varying vec3 vSkyDirection;
  void main() {
    float h = clamp(normalize(vSkyDirection).y * 0.5 + 0.5, 0.0, 1.0);
    vec3 color = h < 0.5
      ? mix(uBottomColor, uMidColor, h * 2.0)
      : mix(uMidColor, uTopColor, (h - 0.5) * 2.0);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const AURORA_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPosition;
  void main(){
    vec4 wp=modelMatrix*vec4(position,1.0);
    vWorldPosition=wp.xyz;
    gl_Position=projectionMatrix*viewMatrix*wp;
  }
`;

export const AURORA_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPosition;
  ${SIMPLEX_GLSL}
  ${RAINBOW_GLSL}
  void main(){
    vec3 dir=normalize(vWorldPosition);
    float h=dir.y;
    float horizonMask=smoothstep(-0.02,0.10,h);
    if(horizonMask<0.001) discard;
    float angle=atan(dir.x,dir.z);
    vec3 totalColor=vec3(0.0);
    for(int layer=0;layer<3;layer++){
      float fl=float(layer);
      float freq=3.0+fl*1.5;
      float ripple=snoise(vec3(
        angle*1.5+fl*7.0,
        h*2.0+uTime*(0.08+fl*0.03),
        uTime*0.05+fl*3.0
      ));
      float curtainAngle=angle*freq+ripple*1.2+fl*2.3;
      float band=pow(max(sin(curtainAngle),0.0),5.0);
      float heightProfile=exp(-h*2.8)*smoothstep(0.0,0.08,h);
      float rays=0.6+0.4*sin(h*25.0+angle*5.0+uTime*0.4+fl*4.0);
      rays*=rays;
      float colorT=fract(
        (angle+3.14159)/(2.0*3.14159)+fl*0.33+uTime*0.015+ripple*0.08
      );
      float layerAlpha=band*heightProfile*rays*(0.85-fl*0.15);
      totalColor+=getRainbow(colorT)*layerAlpha;
    }
    gl_FragColor=vec4(totalColor*1.4,horizonMask*0.40);
  }
`;

export const WORLD_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main(){
    vUv=uv;
    vec4 wp=modelMatrix*vec4(position,1.0);
    vWorldPos=wp.xyz;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  }
`;

export const GROUND_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPos;
  ${RAINBOW_GLSL}
  void main(){
    vec2 p=vWorldPos.xz;
    float dist=length(p);
    float caustic1=0.0;
    for(int i=0;i<3;i++){
      float fi=float(i);
      float a=fi*2.094395;
      vec2 d=vec2(cos(a),sin(a));
      caustic1+=sin(dot(p,d)*3.5+uTime*(0.3+fi*0.15));
    }
    caustic1=pow(abs(caustic1)/3.0,1.5);
    float caustic2=0.0;
    for(int i=0;i<3;i++){
      float fi=float(i);
      float a=fi*2.094395+0.523;
      vec2 d=vec2(cos(a),sin(a));
      caustic2+=sin(dot(p*0.7,d)*4.2+uTime*(0.22+fi*0.12)+5.0);
    }
    caustic2=pow(abs(caustic2)/3.0,1.5);
    float caustic=caustic1*0.6+caustic2*0.4;
    float angle=atan(p.y,p.x);
    float colorT=fract(
      (angle+3.14159)/(2.0*3.14159)+uTime*0.02+caustic1*0.12
    );
    vec3 base=vec3(0.025,0.005,0.05);
    float centerFade=smoothstep(20.0,4.0,dist);
    vec3 color=base+getRainbow(colorT)*caustic*0.40*centerFade;
    float edgeAlpha=smoothstep(22.0,18.0,dist);
    gl_FragColor=vec4(color,edgeAlpha*0.95);
  }
`;

export const ACCENT_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  ${RAINBOW_GLSL}
  void main(){
    float angle=atan(vWorldPos.z,vWorldPos.x);
    float t=fract((angle+3.14159)/(2.0*3.14159)+uTime*0.04);
    vec3 color=getRainbow(t);
    float pulse=0.7+0.3*sin(uTime*1.5+angle*3.0);
    float ringFade=pow(1.0-abs(vUv.y-0.5)*2.0,0.5);
    gl_FragColor=vec4(color*pulse*1.8,ringFade*0.85);
  }
`;

export const SHAFT_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main(){
    vUv=uv;
    vPos=position;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  }
`;

export const SHAFT_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vPos;
  void main(){
    float heightFade=pow(1.0-vUv.y,1.5);
    float edgeFade=pow(max(1.0-abs(vUv.x-0.5)*2.0,0.0),2.0);
    float shimmer=0.7+0.3*sin(vPos.y*3.0+uTime*2.0);
    float alpha=heightFade*edgeFade*shimmer*0.18;
    gl_FragColor=vec4(uColor*2.0,alpha);
  }
`;

export const PRISM_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv=uv;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  }
`;

export const PRISM_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uGlowIntensity;
  uniform float uSpectrumSpeed;
  varying vec2 vUv;
  vec3 hsl2rgb(float h){
    return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);
  }
  void main(){
    vec2 centered=vUv-0.5;
    float dist=length(centered)*2.0;
    float angle=atan(centered.y,centered.x);
    float hue=fract(angle/(2.0*3.14159265)+0.5+uTime*uSpectrumSpeed);
    vec3 spectrumColor=hsl2rgb(hue);
    float iridescentHue=fract(hue+dist*0.3+uTime*uSpectrumSpeed*0.5);
    vec3 iridescentColor=hsl2rgb(iridescentHue);
    vec3 glassBase=vec3(0.95,0.97,1.0);
    float rimStrength=smoothstep(0.3,0.85,dist);
    vec3 color=mix(glassBase,spectrumColor,rimStrength*uGlowIntensity);
    color+=iridescentColor*(1.0-rimStrength)*0.08;
    float downstage=smoothstep(-0.1,0.3,centered.y);
    color+=spectrumColor*rimStrength*downstage*0.15*uGlowIntensity;
    float rimHighlight=smoothstep(0.7,0.95,dist);
    color+=spectrumColor*rimHighlight*0.3*uGlowIntensity;
    float alpha=mix(0.3,0.7,rimStrength);
    alpha*=1.0-smoothstep(0.88,1.0,dist);
    gl_FragColor=vec4(color,alpha);
  }
`;
