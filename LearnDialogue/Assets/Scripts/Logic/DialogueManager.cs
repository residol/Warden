using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Central state machine for the dialogue system.
/// Owns the current graph traversal state and exposes C# Action events
/// that any listener (UI, audio, achievements) can subscribe to without
/// creating a dependency back into this class.
///
/// ARCHITETTURA:
///   • Singleton MonoBehaviour — una sola istanza, vive tra le scene.
///   • Conosce solo il livello Data (i ScriptableObject).
///   • Non sa nulla della UI: usa eventi invece di chiamate dirette.
///   • Perché eventi? → Open/Closed: aggiungere un achievement system
///     significa solo un Subscribe, zero modifiche qui.
/// </summary>
public class DialogueManager : MonoBehaviour
{
    // ── Singleton ────────────────────────────────────────────────────────────

    /// <summary>Global access point. Assigned in <see cref="Awake"/>.</summary>
    public static DialogueManager Instance { get; private set; }

    // ── Events ───────────────────────────────────────────────────────────────

    /// <summary>Fired once when a new dialogue graph is started.</summary>
    public static event Action<DialogueGraphSO> OnDialogueStarted;

    /// <summary>
    /// Fired every time the active node changes.
    /// Subscribers receive the new <see cref="DialogueLineSO"/> to display.
    /// </summary>
    public static event Action<DialogueLineSO> OnLineAdvanced;

    /// <summary>
    /// Fired when the current node has more than one outgoing choice.
    /// Subscribers should present the list to the player.
    /// </summary>
    public static event Action<List<DialogueChoice>> OnChoicePresented;

    /// <summary>Fired when a terminal node is reached or a null next-node is encountered.</summary>
    public static event Action OnDialogueEnded;

    // ── State ─────────────────────────────────────────────────────────────────

    /// <summary>True while a dialogue graph is actively running.</summary>
    public bool IsDialogueActive { get; private set; }

    private DialogueLineSO _currentNode;

    // ── Unity lifecycle ───────────────────────────────────────────────────────

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// <summary>
    /// Starts traversing <paramref name="graph"/> from its entry node.
    /// No-op if a dialogue is already active.
    /// </summary>
    /// <param name="graph">The graph to play. Must have a non-null EntryNode.</param>
    public void StartGraph(DialogueGraphSO graph)
    {
        if (IsDialogueActive)
        {
            Debug.LogWarning("[DialogueManager] Tried to start a graph while one is already active.");
            return;
        }

        if (graph == null || graph.EntryNode == null)
        {
            Debug.LogError("[DialogueManager] Graph or EntryNode is null. Dialogue not started.");
            return;
        }

        IsDialogueActive = true;
        _currentNode = graph.EntryNode;

        OnDialogueStarted?.Invoke(graph);
        AdvanceToNode(_currentNode);
    }

    /// <summary>
    /// Advances the dialogue.
    /// • If the current node is terminal → ends the dialogue.
    /// • If it has exactly one choice → follows it automatically.
    /// • If it has multiple choices → fires <see cref="OnChoicePresented"/>.
    /// Call this from a "Continue" button or from player input.
    /// </summary>
    public void Advance()
    {
        if (!IsDialogueActive || _currentNode == null) return;

        if (_currentNode.IsTerminal)
        {
            EndDialogue();
            return;
        }

        if (_currentNode.Choices.Count == 1)
        {
            // Single implicit continuation — no need to show a choice UI
            AdvanceToNode(_currentNode.Choices[0].NextLine);
        }
        else
        {
            OnChoicePresented?.Invoke(_currentNode.Choices);
        }
    }

    /// <summary>
    /// Selects the choice at <paramref name="index"/> and advances to its target node.
    /// Called by the UI after the player taps a choice button.
    /// </summary>
    /// <param name="index">Zero-based index into <see cref="DialogueLineSO.Choices"/>.</param>
    public void SelectChoice(int index)
    {
        if (!IsDialogueActive || _currentNode == null) return;

        if (index < 0 || index >= _currentNode.Choices.Count)
        {
            Debug.LogWarning($"[DialogueManager] Choice index {index} is out of range (count: {_currentNode.Choices.Count}).");
            return;
        }

        AdvanceToNode(_currentNode.Choices[index].NextLine);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// <summary>
    /// Transitions to <paramref name="node"/>, or ends the dialogue if node is null.
    /// </summary>
    private void AdvanceToNode(DialogueLineSO node)
    {
        if (node == null)
        {
            EndDialogue();
            return;
        }

        _currentNode = node;
        OnLineAdvanced?.Invoke(_currentNode);
    }

    /// <summary>Cleans up state and fires <see cref="OnDialogueEnded"/>.</summary>
    private void EndDialogue()
    {
        IsDialogueActive = false;
        _currentNode = null;
        OnDialogueEnded?.Invoke();
    }
}
