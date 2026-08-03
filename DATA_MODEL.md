# AI 嘴替卡 V0.8 数据模型

## 1. Person

```json
{
  "id": "li",
  "name": "李总",
  "role": "分管领导",
  "mood": "急迫",
  "relationship": "稳定",
  "preference": "结论先行",
  "matter_id": "gov-data",
  "detail": {
    "summary": "……",
    "facts": [],
    "signals": []
  }
}
```

## 2. Matter

```json
{
  "id": "gov-data",
  "person_id": "li",
  "name": "数据治理平台",
  "stage": "需要决策",
  "conflict": "节点与质量",
  "goal": "争取分阶段上线",
  "facts": []
}
```

## 3. ScenarioCard

```json
{
  "id": "li-current",
  "source": "real",
  "channel": "正式会议",
  "title": "本周必须上线",
  "quote": "……",
  "tags": [],
  "back": {
    "focus": "……",
    "goal": "……",
    "confidence": "中高"
  },
  "hand_plan": {}
}
```

`source`：

- `real`：现实发生；
- `hypothesis`：用户疑问；
- `simulation`：AI模拟。

## 4. HandPlan

```json
{
  "axis": "按承诺与目标调整程度展开",
  "coverage": "覆盖五种主要路线",
  "candidates": [
    {
      "card_id": "accept-conditions",
      "rank": "primary",
      "reason": "……",
      "condition": null
    }
  ]
}
```

`rank`：

- `primary`：AI主推荐；
- `backup`：条件备选；
- `other`：其他可行；
- `risk`：AI不推荐或高风险直觉选择。

## 5. ResponseCardDefinition

```json
{
  "id": "accept-conditions",
  "title": "有条件接受",
  "type": "direct",
  "front": {
    "my_voice": "……",
    "partner": "……"
  },
  "choices": [],
  "back": {
    "logic": "……",
    "why": "……",
    "invalid": "……",
    "source": "……"
  }
}
```

## 6. PlayedResponse

```json
{
  "card_id": "accept-conditions",
  "title": "有条件接受",
  "reply": "……",
  "style_name": "我的原声",
  "choice_title": "",
  "ai_rank": "primary",
  "ai_reason": "……"
}
```

## 7. RoundRecord

```json
{
  "id": "round-li-001",
  "person_id": "li",
  "matter_id": "gov-data",
  "turn": 2,
  "saved": true,
  "created_at": "2026-07-28",
  "opponent": {},
  "player": {},
  "outcome": "……",
  "why_saved": "……"
}
```

## 8. History 与 CardPack

- `history`：全部完成的RoundRecord；
- `card_pack`：`saved=true`的RoundRecord子集；
- 取消收藏不删除历史；
- 删除历史时应同步删除卡包引用。

## 9. 推荐的后端实体

最小实体：

- users；
- people；
- matters；
- scenarios；
- rounds；
- saved_round_cards；
- user_voice_events。

非必要不单独建立“卡包配置”“策略包”“行动链牌”等实体。

## 10. ClientSnapshot

V0.8 不建立后端实体，使用带版本号的客户端快照：

```json
{
  "version": 1,
  "savedAt": "2026-07-29T00:00:00.000Z",
  "state": {
    "currentPersonId": "li",
    "currentMatterByPerson": {},
    "sessions": {},
    "pack": []
  },
  "data": {
    "people": [],
    "matters": []
  }
}
```

- `data/demo-data.js` 是唯一内置演示数据源；
- 浏览器自动保存与文件导出使用同一快照协议；
- 导入必须校验协议版本和核心字段；
- 界面筛选、动画、翻面及弹窗状态不进入快照。
