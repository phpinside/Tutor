## 目标
调整「填写基本信息」表单（`src/components/tasks/TaskForm.tsx`），使高考成绩的必填规则与「可教学科」联动：**仅已勾选为可教学科的高考成绩为必填，其余成绩框保留显示但改为选填**。

## 范围
仅修改 `src/components/tasks/TaskForm.tsx`。无需改动服务端 action（`updateTeacherInfo` 已将所有分数字段设为可选）或 Prisma schema。

## 具体改动

### 1. 三个高考成绩输入框（第 388–452 行）—— 星号与 `required` 改为按学科动态判定
对数学/物理/化学三个输入框分别处理：
- 红色星号 `<span className="text-red-500">*</span>` 改为条件渲染：`{formData.subjects.includes('MATH') && <span className="text-red-500">*</span>}`（物理用 `'PHYSICS'`、化学用 `'CHEMISTRY'`）。
- `required` 属性改为：`required={formData.subjects.includes('MATH')}`（物理/化学同理）。
- 输入框本身、onChange 逻辑、满分上限（数学 150 / 物理 110 / 化学 110）、placeholder、提示文案均保持不变。

这样未选学科的成绩框无星号、不触发原生必填校验，与表单中其他选填字段（如毕业年份）的视觉约定一致。

### 2. 提交校验逻辑（第 111–114 行）—— 拆分为「所选学科成绩」与「可辅导学段」两段
将原来的合并校验：
```ts
if (!formData.mathScore || !formData.physicsScore || !formData.chemistryScore || grades.length === 0) {
  alert('请填写高考数学、物理、化学成绩并至少选择一个可辅导学段')
  return
}
```
替换为只校验已选学科成绩，并单独校验可辅导学段：
```ts
const missingScores: string[] = []
if (formData.subjects.includes('MATH') && !formData.mathScore) missingScores.push('数学')
if (formData.subjects.includes('PHYSICS') && !formData.physicsScore) missingScores.push('物理')
if (formData.subjects.includes('CHEMISTRY') && !formData.chemistryScore) missingScores.push('化学')
if (missingScores.length > 0) {
  alert(`请填写所选可教学科的高考成绩：${missingScores.join('、')}`)
  return
}
if (grades.length === 0) {
  alert('请至少选择一个可辅导学段')
  return
}
```

### 3. 不改动 `handleSubjectToggle`
取消勾选某学科时不清空对应成绩（保留已输入值，体验更友好；未选学科的成绩不会被校验，即使填写也不会影响提交）。这与现有「最擅长学科」清空逻辑不同，但成绩字段无一致性约束，无需清空。

## 行为示例
- 仅勾选「数学」→ 高考数学成绩带 `*` 必填，物理/化学成绩框显示但选填。
- 勾选「数学+物理」→ 数学、物理成绩必填，化学选填。
- 未勾选任何学科 → 第 101 行的 `subjects.length === 0` 校验先行拦截，成绩框均无星号。

## 不在范围内
- `registerAndCreateTeacher`（注册路径，独立流程，仅含 mathScore）不改动。
- 服务端 `updateTeacherInfo` 无校验逻辑，无需改动。
- 不涉及数据库迁移。

## 验证
- `npm run lint` 通过。
- `npm run build` 通过（确认无类型错误）。