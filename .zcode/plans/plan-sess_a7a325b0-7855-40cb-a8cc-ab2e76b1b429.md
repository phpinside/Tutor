# 表单改版 + 模板动态布局

## 需求总结
1. 去掉「喜报标题」字段
2. 「提分类目/标题」→「提分科目」下拉框（数学喜报｜物理喜报｜化学喜报），作为模板主标题
3. 「底部补充文案」→「提升策略简介」textarea
4. 所有字段不填则不展示
5. 放大字号，动态布局填满白色区域，更美观

## 改动文件

### 1. `CaseImageGeneratorClient.tsx` — 表单与渲染逻辑

#### a) FormState & 常量
- 删除 `celebrationTitle` 字段
- `scoreTitle` 默认值 `'数学提分'` → `'数学喜报'`
- 新增 `SCORE_SUBJECTS = ['数学喜报', '物理喜报', '化学喜报']`
- `REQUIRED_FIELDS` 移除 `celebrationTitle`
- `DEFAULT_FORM` 移除 `celebrationTitle`

#### b) 新增 `TextAreaField` 组件
复用 `input` 样式，用 `<textarea rows={3}>`，用于「提升策略简介」

#### c) 表单 UI
- 删除「喜报标题」TextField
- 「提分类目/标题」→ `SelectField` label="提分科目" options=SCORE_SUBJECTS
- 「底部补充文案」→ `TextAreaField` label="提升策略简介"

#### d) 渲染逻辑 — 横版（动态垂直分布）

**核心改动**：横版模板改为动态垂直布局，收集所有非空文本块，在白色区域 (y=565~875) 内均匀分布：

```
收集非空块 → 计算各块高度 → gap = (310 - totalHeight) / (n+1) → 逐块绘制
```

5 个文本块（按顺序，空的跳过）：
1. **提分科目**（title）：用 `celebrationTitle` slot，绘制 `form.scoreTitle`，fontSize=48，更显眼
2. **学生行**（student）：`恭喜{region}{grade}{name}同学`，fontSize=32
3. **进步行**（progress）：`学习{duration} · 提分{increase}`（去掉 scoreTitle），fontSize=26
4. **署名**（footer）：[teamName, coachSignature] 过滤空值，fontSize=24，lineHeight=34
5. **策略**（strategy）：bottomNote 按换行拆分，fontSize=22，lineHeight=30

#### e) 渲染逻辑 — 竖版（静态布局，最小改动）
- `form.scoreTitle` 绘制到 `celebrationTitle` slot（大标题位置）
- 不再单独绘制 `scoreTitle` slot
- congratulation 第二行：studyDuration 和 scoreIncrease 都为空时跳过
- footer：[teamName, coachSignature, bottomNote] 过滤空值

### 2. `manifest.json` — 横版模版 textSlots 更新

| slot | 改动 |
|------|------|
| celebrationTitle | fontSize 36→**48**，作为提分科目标题，加阴影更显眼 |
| scoreTitle | 不再使用（保留在 manifest 但代码不引用） |
| student | fontSize 28→**32** |
| progress | fontSize 22→**26** |
| footer | fontSize 18→**24**，lineHeight 26→**34** |
| strategy (新增) | fontSize=22, lineHeight=30, color=#6a3b31 |
| watermark | 不变 |

竖版模版 manifest 不变（代码层面调整绘制内容即可）。

## 验证
- `npx tsc --noEmit` 编译通过
- 横版：5个块全填 → 均匀分布在白色区域 y=565~875，gap≈14px
- 横版：仅填必填项 → 2个块（title+student），自动拉开间距填满区域
- 竖版：scoreTitle（如"数学喜报"）显示在大标题位置
