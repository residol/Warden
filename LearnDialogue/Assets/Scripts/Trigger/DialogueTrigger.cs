using UnityEngine;

/// <summary>
/// Component placed on an NPC that starts a specific dialogue graph
/// when the player is in range and presses the Interact button.
///
/// ARCHITETTURA (Glue layer):
///   • È il solo punto in cui il livello Input incontra il livello Logic.
///   • Non contiene logica di dialogo — delega tutto a <see cref="DialogueManager"/>.
///   • Usa un Trigger Collider per il proximity check: assegna il Collider
///     al GameObject dell'NPC con Is Trigger = true, oppure aggiungi un
///     child GameObject con SphereCollider dedicato.
///   • Il Gizmo giallo visualizza il raggio di interazione nell'editor.
///
/// Requisiti scene:
///   • Il Player deve avere il tag "Player".
///   • L'NPC deve avere un Collider con Is Trigger = true.
///   • <see cref="DialogueManager"/> e <see cref="PlayerInputReader"/>
///     devono esistere nella scena.
/// </summary>
[RequireComponent(typeof(Collider))]
public class DialogueTrigger : MonoBehaviour
{
    // ── Inspector ─────────────────────────────────────────────────────────────

    [Tooltip("The dialogue graph this NPC will play when interacted with.")]
    [SerializeField] private DialogueGraphSO graphToPlay;

    // ── Internal state ────────────────────────────────────────────────────────

    private bool _playerInRange;

    // ── Unity lifecycle ───────────────────────────────────────────────────────

    private void OnEnable()
    {
        PlayerInputReader.OnInteractPerformed += HandleInteract;
    }

    private void OnDisable()
    {
        PlayerInputReader.OnInteractPerformed -= HandleInteract;
    }

    private void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("Player"))
            _playerInRange = true;
    }

    private void OnTriggerExit(Collider other)
    {
        if (other.CompareTag("Player"))
            _playerInRange = false;
    }

    // ── Private ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Called when the player presses Interact.
    /// Guards: player must be in range AND no dialogue must already be running.
    /// </summary>
    private void HandleInteract()
    {
        if (!_playerInRange) return;
        if (DialogueManager.Instance == null) return;
        if (DialogueManager.Instance.IsDialogueActive) return;

        DialogueManager.Instance.StartGraph(graphToPlay);
    }

    // ── Editor helpers ────────────────────────────────────────────────────────

#if UNITY_EDITOR
    /// <summary>
    /// Draws a yellow sphere in the Scene view to visualise the trigger area.
    /// Only visible when the GameObject is selected.
    /// </summary>
    private void OnDrawGizmosSelected()
    {
        var col = GetComponent<Collider>();
        if (col is SphereCollider sphere)
        {
            Gizmos.color = new Color(1f, 0.9f, 0f, 0.4f);
            Gizmos.DrawSphere(transform.position, sphere.radius);
            Gizmos.color = Color.yellow;
            Gizmos.DrawWireSphere(transform.position, sphere.radius);
        }
    }
#endif
}
