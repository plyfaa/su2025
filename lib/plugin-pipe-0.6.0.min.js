var jsPsychPipe=function(i){"use strict";var f="0.6.0",o=(l,t,e)=>new Promise((n,r)=>{var a=s=>{try{c(e.next(s))}catch(d){r(d)}},g=s=>{try{c(e.throw(s))}catch(d){r(d)}},c=s=>s.done?n(s.value):Promise.resolve(s.value).then(a,g);c((e=e.apply(l,t)).next())});const h={name:"pipe",version:f,parameters:{experiment_id:{type:i.ParameterType.STRING,default:void 0},action:{type:i.ParameterType.STRING,default:void 0},filename:{type:i.ParameterType.STRING,default:null},data_string:{type:i.ParameterType.STRING,default:null},wait_message:{type:i.ParameterType.HTML_STRING,default:"<p>Saving data. Please do not close this page.</p>"},compression:{type:i.ParameterType.BOOL,default:!0}},data:{result:{type:i.ParameterType.OBJECT,default:null},success:{type:i.ParameterType.BOOL,default:null}}};function y(l){return o(this,null,function*(){if(typeof CompressionStream=="undefined")return console.warn("plugin-pipe: CompressionStream API is not supported in this browser. Data will be sent uncompressed. Consider using a modern browser (Chrome 80+, Edge 80+, Safari 16.4+, Firefox 113+) to enable compression."),null;const t=new TextEncoder,e=new Blob([t.encode(l)]).stream().pipeThrough(new CompressionStream("gzip"));return new Response(e).blob()})}function u(l,t,e){return o(this,null,function*(){const n=JSON.stringify(t);if(e)try{const r=yield y(n);if(r)return fetch(l,{method:"POST",headers:{"Content-Type":"application/json","Content-Encoding":"gzip",Accept:"*/*"},body:r})}catch(r){console.warn("plugin-pipe: Compression failed. Falling back to uncompressed upload.",r)}return fetch(l,{method:"POST",headers:{"Content-Type":"application/json",Accept:"*/*"},body:n})})}const m=class p{constructor(t){this.jsPsych=t}trial(t,e){this.run(t,e)}run(t,e){return o(this,null,function*(){const n=`
    <style>
      .spinner {
        animation: rotate 2s linear infinite;
        width: 50px;
        height: 50px;
      }

      .spinner .path {
        stroke: rgb(25,25,25);
        stroke-linecap: round;
        animation: dash 1.5s ease-in-out infinite;
      }

      @keyframes rotate {
        100% {
          transform: rotate(360deg);
        }
      }

      @keyframes dash {
        0% {
          stroke-dasharray: 1, 150;
          stroke-dashoffset: 0;
        }
        50% {
          stroke-dasharray: 90, 150;
          stroke-dashoffset: -35;
        }
        100% {
          stroke-dasharray: 90, 150;
          stroke-dashoffset: -124;
        }
      }
    </style>
      ${e.wait_message}
      <svg class="spinner" viewBox="0 0 50 50">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
      </svg>`;t.innerHTML=n;let r;e.action==="save"&&(r=yield p.saveData(e.experiment_id,e.filename,e.data_string,e.compression)),e.action==="saveBase64"&&(r=yield p.saveBase64Data(e.experiment_id,e.filename,e.data_string,e.compression)),e.action==="condition"&&(r=yield p.getCondition(e.experiment_id));var a={result:r,success:!r.error};this.jsPsych.finishTrial(a)})}static saveData(t,e,n,r=!0){return o(this,null,function*(){if(!t||!e||!n)throw new Error("Missing required parameter(s).");try{return yield(yield u("https://pipe.jspsych.org/api/data/",{experimentID:t,filename:e,data:n},r)).json()}catch(a){return a}})}static saveBase64Data(t,e,n,r=!0){return o(this,null,function*(){if(!t||!e||!n)throw new Error("Missing required parameter(s).");try{return yield(yield u("https://pipe.jspsych.org/api/base64/",{experimentID:t,filename:e,data:n},r)).json()}catch(a){return a}})}static getCondition(t){return o(this,null,function*(){if(!t)throw new Error("Missing required parameter(s).");let e;try{e=yield fetch("https://pipe.jspsych.org/api/condition/",{method:"POST",headers:{"Content-Type":"application/json",Accept:"*/*"},body:JSON.stringify({experimentID:t})})}catch(n){return n}return(yield e.json()).condition})}};return m.info=h,m}(jsPsychModule);
//# sourceMappingURL=https://unpkg.com/@jspsych-contrib/plugin-pipe@0.6.0/dist/index.browser.min.js.map
