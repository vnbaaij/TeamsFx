<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@microsoft/teamsfx-api](./teamsfx-api.md) &gt; [FuncQuestion](./teamsfx-api.funcquestion.md)

## FuncQuestion interface

`FuncQuestion` will not show any UI, but load some dynamic data in the question flow; The dynamic data can be refered by the following question.

<b>Signature:</b>

```typescript
export interface FuncQuestion extends BaseQuestion 
```
<b>Extends:</b> [BaseQuestion](./teamsfx-api.basequestion.md)

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [func](./teamsfx-api.funcquestion.func.md) | [LocalFunc](./teamsfx-api.localfunc.md)<!-- -->&lt;any&gt; | A function that will be called to when the question is activated. |
|  [type](./teamsfx-api.funcquestion.type.md) | "func" |  |

