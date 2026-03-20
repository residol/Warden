# LearnDialogue — System Architecture

> Unity 6 · URP · New Input System
> Learning project: branching dialogue system

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                               │
│                                                                 │
│   [DialogueLineSO]  ──── contenuto in ───▶  [DialogueGraphSO]  │
│        │                                          │             │
│    • speakerName                           • entryNode          │
│    • dialogueText                          • List<nodes>        │
│    • List<Choice>                          • (acyclic graph)    │
└────────────────────────┬────────────────────────┬──────────────┘
                         │ read by                │ read by
                         ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LOGIC LAYER                                │
│                                                                 │
│                    [DialogueManager]                            │
│                    (Singleton MonoBehaviour)                    │
│                                                                 │
│    • DialogueGraphSO currentGraph                               │
│    • DialogueLineSO  currentNode                                │
│                                                                 │
│    C# Action events:                                            │
│      OnDialogueStarted(DialogueGraphSO)                         │
│      OnLineAdvanced(DialogueLineSO)                             │
│      OnChoicePresented(List<Choice>)                            │
│      OnDialogueEnded()                                          │
└──────────┬──────────────────────────────────────────┬──────────┘
           │ triggered by                              │ notifies
           │                                           ▼
           │                         ┌─────────────────────────────┐
           │                         │         UI LAYER            │
           │                         │                             │
           │                         │       [DialogueUI]          │
           │                         │   (subscribes to events)    │
           │                         │                             │
           │                         │  • TextMeshPro nameText     │
           │                         │  • TextMeshPro bodyText     │
           │                         │  • Button[] choiceButtons   │
           │                         │  • Coroutine typewriter     │
           │                         └─────────────────────────────┘
           │
           │ starts
┌──────────┴──────────┐
│  [DialogueTrigger]  │     [PlayerInputReader]
│  (on NPC)           │ ◀── triggers ── (New Input System wrapper)
│  • DialogueGraphSO  │
│    graphToPlay      │
└─────────────────────┘
```

---

## Class Responsibilities

| Class | Layer | Responsibility | Knows |
|---|---|---|---|
| `DialogueLineSO` | Data | Single node: text, speaker, available choices | Nobody |
| `DialogueGraphSO` | Data | Full graph: node list + entry node | `DialogueLineSO` |
| `DialogueManager` | Logic | State machine: current node, advance, fire events | Only the SOs |
| `DialogueUI` | View | Text rendering, typewriter effect, choice buttons | Only the events |
| `DialogueTrigger` | Glue | Connects NPC to a graph, starts the manager | `DialogueManager` |
| `PlayerInputReader` | Input | New Input System wrapper, emits pure events | Nobody |

---

## Execution Sequence

```
Player approaches NPC
        │
        ▼
[PlayerInputReader] → "Interact" event
        │
        ▼
[DialogueTrigger].StartDialogue()
   → calls DialogueManager.StartGraph(graphSO)
        │
        ▼
[DialogueManager]
   → stores graphSO, points to entry node
   → fires OnDialogueStarted
   → fires OnLineAdvanced(firstNode)
        │
        ▼
[DialogueUI] receives OnLineAdvanced
   → shows World Space Canvas above NPC
   → starts typewriter Coroutine
        │
     (choice?)
    ┌──┴──┐
   NO    YES
    │     │
    │     ▼
    │  [DialogueUI] shows choice buttons
    │  Player picks → DialogueManager.SelectChoice(i)
    │     │
    ▼     ▼
[DialogueManager] advances to next node
   → fires OnLineAdvanced (or OnDialogueEnded if terminal node)
        │
        ▼
[DialogueUI] receives OnDialogueEnded → hides canvas
```

---

## No Circular Dependencies Rule

```
Data  ←  Logic  ←  View
              ↑
           Trigger / Input

Arrow = "depends on / knows about"
No layer ever looks "upward"
```

`DialogueUI` **never imports** `DialogueManager` directly.
It only subscribes to `Action` delegates.
To advance from UI, it calls `DialogueManager.Instance.Advance()` —
but the manager knows nothing about the UI.

---

## Implementation Order

1. `DialogueLineSO` and `DialogueGraphSO` — data containers, no dependencies
2. `DialogueManager` — state machine, fires events, no UI knowledge
3. `DialogueUI` — subscriber only, pure presentation
4. `DialogueTrigger` + `PlayerInputReader` — entry points, glue code

---

## Extending for Localization

Replace `string dialogueText` in `DialogueLineSO` with a `LocalizationKey` (string).
Add a `LocalizationService` singleton (ScriptableObject or plain class).
`DialogueUI` queries `LocalizationService.Get(key, currentLanguage)` on `OnLineAdvanced`.
`DialogueManager` is **not modified** — Open/Closed principle respected.

---

## Why ScriptableObject vs JSON/XML

| | ScriptableObject | JSON/XML |
|---|---|---|
| Editor integration | Drag-and-drop, Inspector native | Requires custom editor or path management |
| Type safety | Compile-time | Runtime parse errors |
| Runtime cost | Zero parsing | Deserialization on load |
| Referencing | Unity AssetDatabase references | String paths, manual resolution |
| Hot-reload | Unity handles it | Manual reimport logic |

---

## When to Use Events vs Direct Calls

Use `Action` events when the sender should not care who listens.
`DialogueManager` does not know if there is a UI, an achievement system,
or a quest tracker listening. New listeners can subscribe with zero changes
to the manager — Open/Closed principle.

Use direct calls only within the same layer (e.g., `DialogueTrigger` → `DialogueManager`).
