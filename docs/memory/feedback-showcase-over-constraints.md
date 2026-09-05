---
name: feedback-showcase-over-constraints
description: 炫技需求高于维护性红线；粒子、背景、文字动效必须优先用 React Bits Pro 现成组件，不自建；红线可迭代放宽
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5d1a0db4-87db-4490-8a2a-a54b50fc8fa3
  modified: 2026-09-05T08:15:21.074Z
---

owner 在 v5.0 轮（2026-09-05）明确：这个项目除了日常使用也是秀肌肉的，“炫技”需求的层级高于首屏预算、
不引入 three.js 这类维护性红线。粒子、背景组件必须优先用 React Bits Pro / starter 的现成件，不要自建替代品。
所有红线都可以放宽，有必要就迭代去掉。同日补充：体积、文件大小、手机首开速度完全不是考虑项，
这不是搜索首页，多等两三秒可以，慢就上加载动画；该加载的都加载。首屏预算已从闸门与 CI 里撤下，只留报告。

**Why:** 250 KB 首屏预算与“不装 three.js”都是我在维护性优先的前提下自己定的守卫，不是 owner 的要求。
我把它们套到炫技需求上，导致差点用 paper-design 着色器自建背景、自写粒子，偏离了 owner 的原始初衷。

**How to apply:** 涉及动效与视觉特效时，先在 React Bits Pro / starter 与 shadcnblocks 里找现成件，找到就用，
依赖随它装，体积不作为否决理由。遇到红线与炫技冲突，放宽红线并把改动写进 spec，不要反过来削需求。
首开慢就加加载动画，不拿首屏体积卡任何方案。相关：[[project-v5-workspace]]。
