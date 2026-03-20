using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Represents a single node in a dialogue graph.
/// Contains the speaker name, the text to display, and the list of
/// choices that lead to subsequent nodes.
///
/// ARCHITETTURA: questo è il livello Data — non conosce nessun'altra classe.
/// È serializzato come Asset Unity e configurabile via Inspector.
/// </summary>
[CreateAssetMenu(fileName = "NewDialogueLine", menuName = "LearnDialogue/Dialogue Line")]
public class DialogueLineSO : ScriptableObject
{
    [field: SerializeField]
    public string SpeakerName { get; private set; }

    [field: SerializeField, TextArea(3, 8)]
    public string DialogueText { get; private set; }

    [field: SerializeField]
    public List<DialogueChoice> Choices { get; private set; } = new();

    /// <summary>
    /// Returns true when this node has no outgoing choices,
    /// i.e. it is a leaf node that ends the dialogue branch.
    /// </summary>
    public bool IsTerminal => Choices == null || Choices.Count == 0;
}

/// <summary>
/// Represents a directed edge in the dialogue graph:
/// the label shown to the player and the node it leads to.
/// Serializable so it appears natively in the Unity Inspector.
/// </summary>
[Serializable]
public class DialogueChoice
{
    /// <summary>Text shown on the choice button.</summary>
    [field: SerializeField]
    public string ChoiceText { get; private set; }

    /// <summary>
    /// The <see cref="DialogueLineSO"/> node this choice transitions to.
    /// If null the dialogue ends after the choice is selected.
    /// </summary>
    [field: SerializeField]
    public DialogueLineSO NextLine { get; private set; }
}
