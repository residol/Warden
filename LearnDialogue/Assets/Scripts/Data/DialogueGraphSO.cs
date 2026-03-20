using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Represents a complete branching dialogue as a directed acyclic graph.
/// Owns the entry node and the full list of nodes (for editor tooling
/// and validation — the runtime only needs <see cref="EntryNode"/>).
///
/// ARCHITETTURA: livello Data — conosce solo <see cref="DialogueLineSO"/>.
/// Viene assegnato al <see cref="DialogueTrigger"/> dell'NPC via Inspector.
/// </summary>
[CreateAssetMenu(fileName = "NewDialogueGraph", menuName = "LearnDialogue/Dialogue Graph")]
public class DialogueGraphSO : ScriptableObject
{
    /// <summary>
    /// The first node presented to the player when this graph is started.
    /// Must not be null at runtime.
    /// </summary>
    [field: SerializeField]
    public DialogueLineSO EntryNode { get; private set; }

    /// <summary>
    /// All nodes that belong to this graph.
    /// Used by editor validation and by future graph-editor tooling.
    /// The runtime traversal follows <see cref="DialogueChoice.NextLine"/>
    /// references and does not iterate this list.
    /// </summary>
    [field: SerializeField]
    public List<DialogueLineSO> AllNodes { get; private set; } = new();

#if UNITY_EDITOR
    /// <summary>
    /// Editor-only validation: warns if EntryNode is null or not in AllNodes.
    /// Called automatically by Unity when the asset is saved.
    /// </summary>
    private void OnValidate()
    {
        if (EntryNode == null)
            Debug.LogWarning($"[{name}] EntryNode is not assigned.", this);
        else if (!AllNodes.Contains(EntryNode))
            Debug.LogWarning($"[{name}] EntryNode is not in AllNodes list.", this);
    }
#endif
}
