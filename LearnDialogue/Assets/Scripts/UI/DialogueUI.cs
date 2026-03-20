using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Renders the active dialogue line and player choices.
/// Subscribes to <see cref="DialogueManager"/> events and never calls
/// the manager's state-query methods directly — pure presentation layer.
///
/// ARCHITETTURA (MVVM-like):
///   • OnEnable/OnDisable → subscribe/unsubscribe da eventi statici.
///     Questo evita memory-leak se l'oggetto viene disabilitato/distrutto.
///   • Il typewriter effect usa una Coroutine, non Update(), per non
///     sprecare CPU ogni frame quando non c'è testo da animare.
///   • "Continue" può essere collegato sia a un Button Inspector
///     sia a <see cref="PlayerInputReader.OnInteractPerformed"/> — la UI
///     non sa da dove arriva il segnale.
///
/// Setup richiesto in Inspector:
///   dialoguePanel   → il root GameObject del Canvas dialogo
///   speakerNameText → TMP che mostra il nome del parlante
///   dialogueBodyText→ TMP che mostra il testo animato
///   choiceContainer → il parent dei bottoni scelta (disabilitato di default)
///   choiceButtons   → array di Button (almeno quanto le scelte massime)
///   choiceButtonTexts → array TMP parallelo ai bottoni
/// </summary>
public class DialogueUI : MonoBehaviour
{
    [Header("Panel References")]
    [SerializeField] private GameObject dialoguePanel;
    [SerializeField] private TextMeshProUGUI speakerNameText;
    [SerializeField] private TextMeshProUGUI dialogueBodyText;

    [Header("Choice UI")]
    [SerializeField] private GameObject choiceContainer;
    [SerializeField] private Button[] choiceButtons;
    [SerializeField] private TextMeshProUGUI[] choiceButtonTexts;

    [Header("Typewriter Settings")]
    [SerializeField] private float charDelay = 0.04f;

    // ── Internal state ────────────────────────────────────────────────────────

    private Coroutine _typewriterCoroutine;
    private bool _isTyping;

    // The full text of the current line — needed to skip the typewriter
    private string _pendingFullText;

    // ── Unity lifecycle ───────────────────────────────────────────────────────

    private void Awake()
    {
        // Ensure panel is hidden before any dialogue starts
        dialoguePanel.SetActive(false);
        choiceContainer.SetActive(false);
    }

    private void OnEnable()
    {
        DialogueManager.OnDialogueStarted += HandleDialogueStarted;
        DialogueManager.OnLineAdvanced    += HandleLineAdvanced;
        DialogueManager.OnChoicePresented += HandleChoicePresented;
        DialogueManager.OnDialogueEnded   += HandleDialogueEnded;
    }

    private void OnDisable()
    {
        // Always unsubscribe to prevent ghost callbacks after destroy
        DialogueManager.OnDialogueStarted -= HandleDialogueStarted;
        DialogueManager.OnLineAdvanced    -= HandleLineAdvanced;
        DialogueManager.OnChoicePresented -= HandleChoicePresented;
        DialogueManager.OnDialogueEnded   -= HandleDialogueEnded;
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    private void HandleDialogueStarted(DialogueGraphSO graph)
    {
        dialoguePanel.SetActive(true);
        choiceContainer.SetActive(false);
    }

    private void HandleLineAdvanced(DialogueLineSO line)
    {
        choiceContainer.SetActive(false);
        speakerNameText.text = line.SpeakerName;

        _pendingFullText = line.DialogueText;

        if (_typewriterCoroutine != null)
            StopCoroutine(_typewriterCoroutine);

        _typewriterCoroutine = StartCoroutine(TypewriterEffect(_pendingFullText));
    }

    private void HandleChoicePresented(List<DialogueChoice> choices)
    {
        // Wait for typewriter to finish before showing choices
        if (_isTyping)
        {
            SkipTypewriter();
        }

        choiceContainer.SetActive(true);

        for (int i = 0; i < choiceButtons.Length; i++)
        {
            bool visible = i < choices.Count;
            choiceButtons[i].gameObject.SetActive(visible);

            if (!visible) continue;

            choiceButtonTexts[i].text = choices[i].ChoiceText;

            // Capture index in local variable to avoid closure bug
            int capturedIndex = i;
            choiceButtons[i].onClick.RemoveAllListeners();
            choiceButtons[i].onClick.AddListener(
                () => DialogueManager.Instance.SelectChoice(capturedIndex));
        }
    }

    private void HandleDialogueEnded()
    {
        if (_typewriterCoroutine != null)
            StopCoroutine(_typewriterCoroutine);

        _isTyping = false;
        dialoguePanel.SetActive(false);
        choiceContainer.SetActive(false);
    }

    // ── Public API (called by Continue Button or PlayerInputReader) ───────────

    /// <summary>
    /// Called by the "Continue" UI button or by player input.
    /// If the typewriter is still running, skips to the full text.
    /// Otherwise asks the <see cref="DialogueManager"/> to advance.
    /// </summary>
    public void OnContinuePressed()
    {
        if (_isTyping)
        {
            SkipTypewriter();
            return;
        }

        DialogueManager.Instance.Advance();
    }

    // ── Typewriter ────────────────────────────────────────────────────────────

    /// <summary>
    /// Animates <paramref name="fullText"/> one character at a time.
    /// Uses a Coroutine instead of Update() to avoid per-frame overhead
    /// when the dialogue panel is not animating.
    /// </summary>
    private IEnumerator TypewriterEffect(string fullText)
    {
        _isTyping = true;
        dialogueBodyText.text = string.Empty;

        foreach (char c in fullText)
        {
            dialogueBodyText.text += c;
            yield return new WaitForSeconds(charDelay);
        }

        _isTyping = false;
    }

    /// <summary>
    /// Immediately completes the typewriter, showing the full text at once.
    /// </summary>
    private void SkipTypewriter()
    {
        if (_typewriterCoroutine != null)
            StopCoroutine(_typewriterCoroutine);

        dialogueBodyText.text = _pendingFullText;
        _isTyping = false;
    }
}
