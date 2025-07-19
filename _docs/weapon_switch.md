Here is a plan to implement the weapon switching feature with a focus on minimal, client-side changes.

### High-Level Plan

The implementation will be entirely on the client-side, primarily within the `client/src/components/Player.tsx` component. This approach avoids any modifications to the server-side Rust code, adhering to the constraint of not changing the server. The feature will be managed by a new state variable that tracks the selected weapon, which will drive changes in animations and the visual attachment of the sword model.

Here is a flowchart of the proposed logic:

Ran tool

### Plan for Implementing Weapon Switching

This plan outlines the steps to implement a weapon-switching feature, allowing the player to equip and unequip a sword by pressing the 'J' key. The implementation is designed to be entirely client-side, ensuring no changes are needed for the server logic and minimizing the risk of breaking existing combat functionality.

The core of this feature will be implemented in `client/src/components/Player.tsx`.

#### 1. State Management for Weapon Mode

I will introduce a new state within the `Player.tsx` component to manage the currently equipped weapon. This will be designed to be easily extensible for future weapons.

-   **Create a `weaponModes` array:** This array will define the available weapon states. Initially, it will be `['UNARMED', 'SWORD']`. This makes adding new weapons in the future a matter of extending this array.
-   **Introduce `weaponIndex` state:** A React state hook (`useState`) will be used to keep track of the current index in the `weaponModes` array. For example, `const [weaponIndex, setWeaponIndex] = useState(0);` would default the player to `UNARMED`.

#### 2. Input Handling

I will add a new effect hook to handle the key press for switching weapons.

-   **Listen for 'J' key press:** A `useEffect` hook will add a `keydown` event listener to the document.
-   **Cycle through weapons:** When the 'J' key is pressed, the `weaponIndex` state will be updated, cycling through the `weaponModes` array. The logic will be `setWeaponIndex((prevIndex) => (prevIndex + 1) % weaponModes.length);`.

#### 3. Conditional Sword Attachment

The logic for attaching the sword model to the player character will be updated to be conditional, based on the current weapon mode.

-   **Identify Bone Names:** I will inspect the player model's skeleton within `Player.tsx` to identify the names for the right hand bone (e.g., `mixamorigRightHand`) and a suitable back/spine bone (e.g., `mixamorigSpine2`).
-   **Modify Sword Parent:** I will find the code where the sword GLB is loaded and attached to the player. I will modify this so that the sword's parent bone is dynamically set based on `weaponModes[weaponIndex]`.
    -   If mode is `'SWORD'`, the sword will be parented to the hand bone.
    -   If mode is `'UNARMED'`, the sword will be parented to the back bone. I will also adjust its position and rotation to look natural on the player's back.

#### 4. Animation State Logic

The existing animation state machine will be modified to incorporate the current weapon mode, ensuring the correct attacks are used.

-   **Segregate Animations:** I will update the animation selection logic. When an attack is triggered (e.g., by pressing 'F'), the code will first check the `weaponModes[weaponIndex]` state.
    -   If `'UNARMED'`, it will play the existing melee attack animations (e.g., `Mma Kick`).
    -   If `'SWORD'`, it will play the sword-based attack animations (e.g., `Sword And Shield Slash`).
-   **Movement Animations:** The logic for idle, running, and jumping animations will also be checked. If there are different animations for holding a sword versus being unarmed, this logic will be updated to select the appropriate animation based on the weapon mode.

This plan achieves the desired functionality by making localized changes within a single client component, respecting the constraint to avoid server modifications and ensuring the existing combat system remains intact.