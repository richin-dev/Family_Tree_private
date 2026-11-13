#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const sourceDir = 'D:/vids/edited';
const outputDir = 'video-assets';
const files = [
  ['Thankamma_Kochappan.mp4','Thankamma_Kochappan.mp4'],
  ['Anthony kadavy.mp4','Anthony kadavy.mp4'],
  ['Jose Kadavy.MOV','Jose Kadavy.mp4']
];
fs.mkdirSync(outputDir,{recursive:true});
for (const [inputName,outputName] of files) {
  const input = path.join(sourceDir,inputName), output = path.join(outputDir,outputName);
  if (!fs.existsSync(input)) throw new Error('Missing original video: '+input);
  const result = spawnSync('ffmpeg',['-hide_banner','-y','-i',input,'-map','0:v:0','-map','0:a?','-vf',"scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",'-c:v','libx264','-preset','slow','-crf','23','-profile:v','high','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-metadata','title='+inputName,output],{stdio:'inherit'});
  if (result.error) throw new Error('Could not start ffmpeg: '+result.error.message+'. Install FFmpeg and add ffmpeg to PATH.');
  if (result.status !== 0) throw new Error('FFmpeg could not prepare '+inputName+'.');
  console.log('Prepared '+output);
}
