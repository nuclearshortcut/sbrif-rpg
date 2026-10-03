/*:
* @target MZ
* @plugindesc A modification for SBRif that attaches a grid-based positioning system to Combat
* @author setsuna04
*
* @command PositionEnemy
* @text Set an Enemy's Position
* @desc Change an Enemy's Node, and potentially their sprite.
*
* @arg enemyToSet
* @text Enemy Troop Index
* @desc Index of the enemy to change within the troop
* @type number
* 
* @arg targetNode
* @text Node Position ID
* @desc Positional ID of the Node the enemy is moving to
* @type number
* 
*/

(() => {

    const pluginName = "SBR_GridCombat";
    const parameters = PluginManager.parameters(pluginName);

    //======================================================================================================================================================
    // POSITIONING FRAMEWORK
    //======================================================================================================================================================

    // Battle Nodes
    class BattleNode {
        constructor(row, lane, screenX, screenY, posID) {
            this.row = row;
            this.lane = lane;

            this.enemyBattler = null; // Enemy Battler stored at the position

            this.screenX = screenX; 
            this.screenY = screenY;
            this.posID = posID;
        }
    }

    // Grid has a set of NINE positional Nodes where Enemies are stored and can move between on SEPARATE Grids
    function createBattleGrid()
    {

        return [
            new BattleNode ("FRONT", "LEFT", 500, 500, 0),
            new BattleNode ("FRONT", "CENTER", 0, 0, 1),
            new BattleNode ("FRONT", "RIGHT", 0, 0, 2),

            new BattleNode ("MID", "LEFT", 0, 0, 3),
            new BattleNode ("MID", "CENTER", 0, 0, 4),
            new BattleNode ("MID", "RIGHT", 0, 0, 5),

            new BattleNode ("BACK", "LEFT", 0, 0, 6),
            new BattleNode ("BACK", "CENTER", 0, 0, 7),
            new BattleNode ("BACK", "RIGHT", 0, 0, 8),

            new BattleNode ("NULL", "NULL", -1, -1, -1) // A temporary, off screen position at index 9
        ]

    }

    const ENEMY_GRID = createBattleGrid();
    // Grid Visual:
    //       Left Center Right
    // Back   [6    7    8
    // Mid     3    4    5
    // Front   0    1    2]

    // NOTE ----------------------------------------------------------------------------
      // Enemies have multiple variations separated by Row type, labeled via note-tag (EX: For Enemy '(F) Goblin', <Variants: (M) Goblin, (B) Goblin>)
      // All Enemies also store their intended Row via note-tag (EX: '(M) Goblin' would have <Row: MID>)
    //----------------------------------------------------------------------------------

    // Plugin Command to Change Enemy's Node (Replaces Enemy Transform)
        // Takes 3 arguments:
        // Enemy to Set (enemy ID)
        // Target Battle Node
    PluginManager.registerCommand(pluginName, "PositionEnemy", args =>{
        const enemyToSet = Number(args.enemyToSet);
        const targetNode = Number(args.targetNode);

        console.log("GridCombat: Running 'PositionEnemy' Command");
        console.log("PositionEnemy: Searching for objects...");

        if (targetNode < -1 || targetNode > 8) {throw new Error("PositionEnemy: Target Node ID is too large or low!");}
        
        // Get the Enemy Object
        let enemyObj = $gameTroop.members()[enemyToSet];
        if (enemyObj == null) {throw new Error("PositionEnemy: Enemy to Change is Missing!");}

        let oldNodeObj;
        let targetNodeObj;

        // Get the Old Node object (the original Node)
        for (const node of ENEMY_GRID)
        {
            if (node.enemyBattler == enemyObj)
            {
                oldNodeObj = node;
                break;
            }
        }
        if (oldNodeObj == null) {console.warn("PositionEnemy: Old Node is Missing!");}

        // Get the Target Node object
        for (const node of ENEMY_GRID)
        {
            if (node.posID == targetNode)
            {
                targetNodeObj = node;
            }
        }
        if (targetNodeObj == null) {throw new Error("PositionEnemy: Target Node is Missing!");}

        BattleManager.positionEnemy(enemyObj, oldNodeObj, targetNodeObj);

    });

    // PositionEnemy - Handles the setting and potential exchange of Enemy Node positions
    BattleManager.positionEnemy = function(movingEnemy, oldNode, targetNode)
    {
        console.log("PositionEnemy: All objects found! Accessing corresponding BattleManager method...");
        console.log("PositionEnemy: Assigning Node for " + movingEnemy.name() + "...")

        if (ENEMY_GRID[9].enemyBattler != null) {throw new Error("PositionEnemy: Temp Battle Node should not be occupied!");}

        // If the Target Node is occupied, swap the Enemies' positions
        if (targetNode.enemyBattler != null)
        {
            console.log("PositionEnemy: Target Node occupied! Exchanging positions...");

            if (oldNode == null) {throw new Error("PositionEnemy: Cannot exchange positions when Old Node was not found!");}
            if (targetNode == null) {throw new Error("PositionEnemy: Cannot exchange positions when Target Node was not found!");}

            let e1 = movingEnemy; // Original Enemy
            let e2 = targetNode.enemyBattler; // Occupying Enemy

            // Transform each enemy into their Variant if needed
            if (targetNode.row != oldNode.row) {
                e1.transform(BattleManager.getEnemyVariantID(e1, oldNode));
                e2.transform(BattleManager.getEnemyVariantID(e2, targetNode));
            }

            // Move e1 to the temp Node
            console.log("PositionEnemy: Moving E1 to temporary Node.");
            oldNode.enemyBattler = null;
            ENEMY_GRID[9].enemyBattler = e1;
            e1._screenX = ENEMY_GRID[9].screenX;
            e1._screenY = ENEMY_GRID[9].screenY;

            // Move e2 to the Old Node
            console.log("PositionEnemy: Moving E2 to E1's original Node");
            targetNode.enemyBattler = null;
            oldNode.enemyBattler = e2;
            e2._screenX = oldNode.screenX;
            e2._screenY = oldNode.screenY;

            // Move e1 to the Target Node
            onsole.log("PositionEnemy: Moving E1 to Target Node");
            targetNode.enemyBattler = e1;
            e1._screenX = targetNode.screenX;
            e1._screenY = targetNode.screenY;

            console.log("PositionEnemy: " + e1.name() + " successfully assigned to Node " + targetNode.posID + ", " + targetNode.row + "-" + targetNode.lane + "!");
            console.log("PositionEnemy: " + e2.name() + " successfully assigned to Node " + oldNode.posID + ", " + oldNode.row + "-" + oldNode.lane + "!");

        }
        // Otherwise, move the Enemy to the Target Node
        else 
        {

            // If they are already assigned to a Node, make sure to empty it
            if (oldNode != null)
            {
                // Transform the enemy into their Variant if one is needed
                if (targetNode.row != oldNode.row) {
                    movingEnemy.transform(BattleManager.getEnemyVariantID(movingEnemy, targetNode));
                }

                // Empty original Node
                oldNode.enemyBattler = null;
            }

            // Move Enemy to the Target Node
            targetNode.enemyBattler = movingEnemy;
            movingEnemy._screenX = targetNode.screenX;
            movingEnemy._screenY = targetNode.screenY;

            // TODO - check that enemy Row equals Node Row

            console.log("PositionEnemy: " + movingEnemy.name() + " successfully assigned to Node " + targetNode.posID + ", " + targetNode.row + "-" + targetNode.lane + "!");

        }
    }

    BattleManager.getEnemyVariantID = function(movingEnemy, targetNode)
    {
        const enemyVariantNames = movingEnemy.enemy().meta.Variants.split(", "); // List of all the names of the enemy's variants
        let enemyVariant;

        // Get the Variant name that shares the same Row as the Target Node
        for (const variantName of enemyVariantNames)
        {
            // Search for an enemy in the database with correct name. Verify that its Rows tag is appropriate
            if (targetNode.row[0] == variantName[1]) {
                enemyVariant = $dataEnemies.find(enemy => enemy.name === variantName);
                if (enemyVariant.meta.Row.toLowerCase() != targetNode.row.toLowerCase())
                {
                    throw new Error("PositionEnemy: Variant for " + movingEnemy.name() + "found, but its Row does not match Target Node at Row " + targetNode.row);
                }
                break;
            }
        }
        if (enemyVariant == null) {throw new Error("PositionEnemy: No Variant at Row " + targetNode.row + " found for " + movingEnemy.name())}

        return enemyVariant.id;

    }


    // TODO (above) - Fix Sprite relocation (Check Game_Enemy, Game_Battler, and Game_Battler_Base

    // TODO - Store troop index of Enemy

    // TODO - When an Enemy dies, empty their Node

    // TODO - Skills

})();