/* DangoMusic LyricsModule.kt: spawn (reveal duration), drawAnimated and
 * drawTranslation. The original 55ms / 60% / 180ms / 160ms / 0.55 / 5px
 * rules are kept. Browser adaptation: visible graphemes replace Kotlin Char;
 * the word-pop size envelope is applied to each grapheme's normal reveal slot.
 * These are sentence-relative reveals, not invented per-syllable timestamps.
 */
class DangoCharacterMotion {
 static units(text){return typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(String(text)),x=>x.segment):Array.from(String(text));}
 static revealMs(count,lineMs){return Math.min(Math.max(count*55,250),Math.max(400,lineMs)*.6);}
 static smooth(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
 static glyph(index,count,elapsedMs,revealMs){const elapsed=elapsedMs-index/Math.max(1,count)*revealMs,alpha=this.smooth(elapsed/180),back=Math.max(0,Math.min(1,1-elapsed/160));return{alpha,scale:1+.55*back*back,lift:(1-alpha)*5};}
 static translationAlpha(elapsedMs){return this.smooth((elapsedMs-120)/260)*.85;}
}
