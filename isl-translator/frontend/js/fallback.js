// Confidence-gated spelling fallback state machine.
import { logKpi } from "./kpiLogger.js";
export function createFallback({onChange=()=>{}}={}) { let state="TRACKING", misses=0; return { observeLowConfidence(){ if(++misses>=3&&state!=="FALLBACK_SPELLING"){state="FALLBACK_SPELLING";logKpi("fallback_triggered");onChange(state);} }, resolve(){misses=0;if(state!=="TRACKING"){state="TRACKING";logKpi("fallback_resolved");onChange(state);}}, observeConfidence(){misses=0;}, getState:()=>state }; }
