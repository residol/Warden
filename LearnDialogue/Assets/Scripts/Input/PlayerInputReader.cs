using System;
using UnityEngine;
using UnityEngine.InputSystem;

/// <summary>
/// Thin wrapper around the New Input System.
/// Translates raw <see cref="InputAction"/> callbacks into plain C# Action events
/// so that any consumer (<see cref="DialogueTrigger"/>, UI) can subscribe without
/// knowing anything about Unity's input pipeline.
///
/// ARCHITETTURA:
///   • Unico punto di contatto con UnityEngine.InputSystem — se domani
///     si cambia backend (es. passare a un custom input manager) basta
///     modificare solo questa classe.
///   • Emette eventi statici (zero accoppiamento con i subscriber).
///   • Richiede un InputActionAsset assegnato in Inspector con una
///     ActionMap "Player" contenente un'Action "Interact".
/// </summary>
public class PlayerInputReader : MonoBehaviour
{
    // ── Events ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Fired when the player performs the "Interact" action
    /// (default binding: E on keyboard, South button on gamepad).
    /// </summary>
    public static event Action OnInteractPerformed;

    // ── Inspector ─────────────────────────────────────────────────────────────

    [Tooltip("The InputActionAsset that contains the 'Player' action map.")]
    [SerializeField] private InputActionAsset inputActions;

    // ── Internal ──────────────────────────────────────────────────────────────

    private InputAction _interactAction;

    // ── Unity lifecycle ───────────────────────────────────────────────────────

    private void Awake()
    {
        // Resolve the action once — avoids repeated string lookups at runtime
        var playerMap = inputActions.FindActionMap("Player", throwIfNotFound: true);
        _interactAction = playerMap.FindAction("Interact", throwIfNotFound: true);
    }

    private void OnEnable()
    {
        _interactAction.Enable();
        _interactAction.performed += HandleInteract;
    }

    private void OnDisable()
    {
        _interactAction.performed -= HandleInteract;
        _interactAction.Disable();
    }

    // ── Private ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Converts the InputSystem callback into a plain Action event.
    /// The <paramref name="ctx"/> parameter is intentionally ignored:
    /// subscribers only need to know the action fired, not its details.
    /// </summary>
    private void HandleInteract(InputAction.CallbackContext ctx)
    {
        OnInteractPerformed?.Invoke();
    }
}
