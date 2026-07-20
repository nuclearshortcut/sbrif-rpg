/*:
* @target MZ
* @plugindesc A combat modification for SBRif... that attaches a grid-based positioning system to combat
* @author setsuna04
*
*
*
*/

const pluginName = "SBR_GridCombat";
const parameters = PluginManager.parameters(pluginName);

(() => {

    // Battle Positions
    class BattlePos {
        constructor(distance, lane, screenX, screenY, posID) {
            this.distance = distance;
            this.lane = lane;

            this.stationedBattler = null;

            this.posID = posID;
            this.screenX = screenX;
            this.screenY = screenY;
        }
    }

    // The Player Side and the Enemy Side each have a set of NINE Positions 
    // where Battlers are stored and can move between on SEPARATE Grids
    function createBattleGrid()
    {

        return [
            new BattlePos ("SHORT", "LEFT", 0, 0, 0),
            new BattlePos ("SHORT", "CENTER", 0, 0, 1),
            new BattlePos ("SHORT", "RIGHT", 0, 0, 2),

            new BattlePos ("MID", "LEFT", 0, 0, 3),
            new BattlePos ("MID", "CENTER", 0, 0, 4),
            new BattlePos ("MID", "RIGHT", 0, 0, 5),

            new BattlePos ("LONG", "LEFT", 0, 0, 6),
            new BattlePos ("LONG", "CENTER", 0, 0, 7),
            new BattlePos ("LONG", "RIGHT", 0, 0, 8)
        ]

    }

    const PLAYER_GRID = createBattleGrid();
    // Position ID Visual:
    // SHORT  [0 1 2
    // MID     3 4 5
    // LONG    6 7 8]

    const ENEMY_GRID = createBattleGrid();
    // Position ID Visual:
    // LONG   [6 7 8
    // MID     3 4 5
    // SHORT   0 1 2]

    function clearBattleGrid(grid)
    {
        for (const pos of grid)
        {
            pos.stationedBattler = null;
        }
    }

    // Every Actor has their Initial Battle Position stored in the custom property, ._initBattlePos
    // In order, every Troop member has their Initial Battle Position stored in the notetag meta-data, <InitBattlePos: 1, 2, 3, ...>

    //======================================================================================================================================================
    //======================================================================================================================================================
    
    // Initialize all Party Members' Battle Positions

    // _initBattlePos = 0, 1,... or 8. Each number corresponds with a Battle Position's ID. The Party Member will
    // set its Initial Position to the Battle Position with the same ID

    const _Game_Actor_setup = Game_Actor.prototype.setup;
    Game_Actor.prototype.setup = function(actorId) {
        _Game_Actor_setup.call(this, actorId);
        this._initBattlePos = null;
    };

    Game_Actor.prototype.battlePos = function() {
        return this._initBattlePos;
    };

    Game_Actor.prototype.setBattlePos = function(pos) {
        this._initBattlePos = pos;
    };

    // Set max Party Members to 9
    const _Game_Party_maxBattleMembers = Game_Party.prototype.maxBattleMembers;
    Game_Party.prototype.maxBattleMembers = function() {
        return 9; 
    };

    
    //======================================================================================================================================================
    //======================================================================================================================================================

    // Altered Menu
    // Move HP to the top of Actor display, and MP to the bottom
    Window_StatusBase.prototype.placeBasicGauges = function(actor, x, y) {
        this.placeGauge(actor, "hp", x, y - 40);
        this.placeGauge(actor, "mp", x, y + this.gaugeLineHeight() + 40);
    };

    // Draw HP, MP, and Icons
    Window_StatusBase.prototype.drawActorSimpleStatus = function(actor, x, y) {
        const lineHeight = this.lineHeight();

        this.drawActorIcons(actor, x, y + lineHeight * 2);
        this.placeBasicGauges(actor, x, y + lineHeight);
    };

    // Display up to 9 tiles
    Window_MenuStatus.prototype.maxItems = function() {
        return 9;
    };

    // Resized the Party Member Display to 3x3 grid of tiles
    Window_MenuStatus.prototype.maxCols = function() {
        return 3;
    };

    // Center actor images to the middle of their tiles
    Window_MenuStatus.prototype.drawItemImage = function(index) {

        const actor = this.actor(index);

        if (!actor)
        {
            return;
        }
        else 
        {
            const actor = this.actor(index);
            const rect = this.itemRect(index);
            const width = ImageManager.standardFaceWidth;
            const height = rect.height - 2;
            this.changePaintOpacity(actor.isBattleMember());
            this.drawActorFace(actor, rect.x + 15, rect.y + 1, width, height);
            this.changePaintOpacity(true);
        }

    };
    
    // Displays only each Actor's face, HP, and MP on each slotted tile
    Window_MenuStatus.prototype.drawItemStatus = function(index) {

        const actor = this.actor(index);
        
        if (!actor)
        {
            return;
        }
        else 
        {
            const actor = this.actor(index);
            const rect = this.itemRect(index);
            const x = rect.x
            const y = rect.y;
            this.drawActorSimpleStatus(actor, x, y);
        }

    };
    
    // Manages Party Member Initial Battle Positions


    // When a Party Member joins, check through the Initial Positions from least to greatest, assigning them
    // to the first available slot found


    //======================================================================================================================================================
    //======================================================================================================================================================


    // Assigns Battlers to a Position in a Grid
    function assignBattlerToGrid(grid, battler, posID)
    {
        if (posID > 8)
        {
            throw new Error(
                `${posID} for ${battler} EXCEEDS POSITION ID MAXIMUM OF '8'`
            );
        }
        if (posID < 0)
        {
            throw new Error(
                `${posID} for ${battler} BELOW POSITION ID MINIMUM OF '0'`
            );
        }

        for (const pos of grid)
        {
            if (pos.posID === posID) 
            {
                if (pos.stationedBattler === null)
                {
                    pos.stationedBattler = battler;
                }
                else
                {
                    throw new Error(
                        `POSITION ${pos.distance}_${pos.lane} IS ALREADY IN USE`
                    );
                }
            }
        }
    }

    // On Battle Start...
      // For each Actor, read their _initBattlePos property
      // Check if that Position is taken by a partyBattler. If it is, throw new error. If not, assign them to that Position
      // ...
      // For each Troop member (aka, Enemy), read their InitBattlePosition notetag meta-data
      // Check if that Position is taken by an enemyBattler. If it is, throw new error. If not, assign them to that Position
    const _BattleManager_startBattle = BattleManager.startBattle;
    BattleManager.startBattle = function() {
        _BattleManager_startBattle.call(this);

        // Make sure each Grid is clear
        clearBattleGrid(PLAYER_GRID);
        clearBattleGrid(ENEMY_GRID);
        
        // Assign Actor Positions
        for (const actor of $gameParty.battleMembers()) {
            assignBattlerToGrid(PLAYER_GRID, actor, actor.battlePos())
        }
        console.log("All Party Members assigned to a Position")

        // Assign Enemy Positions
        const troopInitialPos = $gameTroop.troop().meta.InitialBattlePosition.split(",").map(s => Number(s.trim()));

        // Ensure there's an equivalent amount of Enemies and Positions
        if ($gameTroop.members().length != enemyInitialPos.length) {
            throw new Error(
                "THERE IS AN UNEQUAL AMOUNT OF ENEMIES AND INITIAL POSITIONS IN THE TROOP"
            );
        }

        let i = 0;
        troopInitialPos.forEach(initPos => {
            assignBattlerToGrid(ENEMY_GRID, $gameTroop.members()[i], initPos);
            i++;
        });
        console.log("All Enemies assigned to a Position")

        console.log("Battle Start");
    };

    //======================================================================================================================================================
    //======================================================================================================================================================

    // During Battle...
      // Base on each Position's ScreenX and ScreenY, assign the location of each Battler from furthest to closest
      // If an Enemy dies, free up their Position

    // Function: Reassign a Battler's Position
      // Check if they're already in a Position. If they are, remove them
      // Check if the new Position is empty. If it is, assign them. If not, throw new error

    // Function: Swap two Battlers' Positions
      // Check that both Positions are filled. If not, throw new error
      // If they are, swap them

    // Function: Rewrite

})();