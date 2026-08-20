/*:
* @target MZ
* @plugindesc A modification for SBRif... that attaches a grid-based positioning system to combat
* @author setsuna04
*
*
*
*/

(() => {

    const pluginName = "SBR_GridCombat";
    const parameters = PluginManager.parameters(pluginName);

    //======================================================================================================================================================
    // POSITIONING FRAMEWORK
    //======================================================================================================================================================

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

    const ENEMY_GRID = createBattleGrid();
    // Position ID Visual:
    // LONG   [6 7 8
    // MID     3 4 5
    // SHORT   0 1 2]

    const PLAYER_GRID = createBattleGrid();
    // Position ID Visual:
    // SHORT  [0 1 2
    // MID     3 4 5
    // LONG    6 7 8]

    //======================================================================================================================================================
    // GENERAL GRID & POSITIONING FUNCTIONS
    //======================================================================================================================================================

    function clearBattleGrid(grid)
    {
        for (const pos of grid)
        {
            pos.stationedBattler = null;
        }
    }

    // Function that assigns Battlers to a Position in a Grid
    function assignBattlerToGrid(grid, battler, posID)
    {
        if (battler.isActor())
        {
            console.log(`Party Member ${battler.actorId()} has been assigned to Position ${posID} in Player Grid`)
        }
        else if (battler.isEnemy())
        {
            console.log(`Enemy ${battler.enemyId()} has been assigned to Position ${posID} in Enemy Grid`)
        }

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

    // Function that swaps the Position of two Battlers
    function swapBattlersInGrid(grid, battlerA, battlerB)
    {
        let posA = null;
        let posB = null;

        for (const pos in grid)
        {
            if (pos.stationedBattler === battlerA)
            {
                posA = pos;
            }
            if (pos.stationedBattler === battlerB)
            {
                posB = pos;
            }
        }

        if (!posA || !posB)
        {
            throw new Error("Could not find both battlers in grid");
        }
        posA.stationedBattler = battlerB;
        posB.stationedBattler = battlerA;
    }

    // Function to get Init Battle Position meta-data for a Troop from a
    // comment on their first event page
    function getTroopInitBattlePos()
    {
        const list = $gameTroop.troop().pages[0].list;

        for (const command of list)
        {
            if (command.code === 108)
            {
                const match = command.parameters[0]
                    .match(/<InitBattlePos:\s*(.*?)>/);

                if (match)
                {
                    return match[1]
                        .split(",")
                        .map(Number);
                }
            }
        }

        throw new Error("Missing InitBattlePos Comment");
    }

    //======================================================================================================================================================
    // INITIAL BATTLE POSITION
    //======================================================================================================================================================

    // Every Actor has their Initial Battle Position stored in the custom property, ._initBattlePos
    // In order, every Troop member has their Initial Battle Position stored in comment meta-data, <InitBattlePos: 1, 2, 3, ...>
    // _initBattlePos = 0, 1,... or 8. Each number corresponds with a Battle Position's ID. The Party Member will
    // set its Initial Position to the Battle Position with the same ID

    // Assign the property _initBattlePos to all Battlers
    const _Game_Actor_setup = Game_Actor.prototype.setup;
    Game_Actor.prototype.setup = function(actorId) {
        _Game_Actor_setup.call(this, actorId);
        this._initBattlePos = null;
    };

    // Initial Battle Position Getter
    Game_Actor.prototype.getBattlePos = function() {
        return this._initBattlePos;
    };

    // Initial Battle Position Setter
    Game_Actor.prototype.setBattlePos = function(pos) {
        this._initBattlePos = pos;
    };

    // Set max Party Members to 9
    const _Game_Party_maxBattleMembers = Game_Party.prototype.maxBattleMembers;
    Game_Party.prototype.maxBattleMembers = function() {
        return 9; 
    };
    
    //======================================================================================================================================================
    // ARRANGEMENT MENU
    //======================================================================================================================================================

    // A new Arrangeent window accessible from the pause menu to preset the Initial Battle Positions of Party Members within
    // a grid where the tiles correspond with the Positions in the PLAYER_GRID
    // By reassigning actors to different 'slots' in the Formation, their Initial Battle Position is changed
    // So if Player Arrangement:
    // A B X
    // X X X
    // X X X
    // And I swap Party Members A and B, then
    // B A X
    // X X X
    // X X X
    // A is now SHORT-CENTER POSITION, and B is now SHORT-LEFT POSITION,

    const _Game_Party_initialize = Game_Party.prototype.initialize;
    Game_Party.prototype.initialize = function() {
        _Game_Party_initialize.call(this);
        this._PARTY_ARRANGEMENT = [ null, null, null,
                                    null, null, null,
                                    null, null, null ]
    };

    //
    //--------------------------------------------
    // Create Arrangement Display
    //

    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function() {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler("arrangement", this.commandArrangment.bind(this))
    };

    Scene_Menu.prototype.commandArrangment = function() {
        SceneManager.push(Scene_Arrange);
        //check Command Formation***

        this._commandWindow.activate();
    };

    //
    //--------------------------------------------
    // Create Arrangement Scene
    //
    function Scene_Arrange() {
        this.initialize(...arguments);
    }

    Scene_Arrange.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_Arrange.prototype.constructor = Scene_Arrange;

    Scene_Arrange.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_Arrange.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        this.createArrangeWindow();
    };

    // Creates Arrangeent Menu Window
    Scene_Arrange.prototype.createArrangeWindow = function() {
        const rect = this.arrangeWindowRect();
        this._arrangeWindow = new Window_Arrange(rect);
        
   
        
        this._arrangeWindow.setHandler("ok", this.onArrangeOk.bind(this));
        this._arrangeWindow.setHandler("cancel",this.onArrangeCancel.bind(this));
        

        this.addWindow(this._arrangeWindow);
    };

    // Selects Battler or Sets Position of Selection
    Scene_Arrange.prototype.onArrangeOk = function() {
        const pendingIndex = this._arrangeWindow.pendingIndex();
        const currentIndex = this._arrangeWindow.index();
        
        console.log("Pending:", pendingIndex, "Current:", currentIndex);

        if (pendingIndex === -1) 
        {
            this._arrangeWindow.setPendingIndex(currentIndex);
        } 
        // Handle swapping Arrangement slots
        else 
        {
            if (pendingIndex === currentIndex) 
            {
                this._arrangeWindow.setPendingIndex(-1);
            } 
            else 
            {
                this.swapArrangement(currentIndex, pendingIndex);
            }
        }
        
        this._arrangeWindow.activate();
    };

    // Swaps Arrangement Position
    Scene_Arrange.prototype.swapArrangement = function (index1, index2)
    {
        console.log("Swap Data. First Index:", index1, "Second Index:", index2)

        const temp = $gameParty._PARTY_ARRANGEMENT[index1];

        $gameParty._PARTY_ARRANGEMENT[index1] = $gameParty._PARTY_ARRANGEMENT[index2];
        $gameParty._PARTY_ARRANGEMENT[index2] = temp;
                
        this._arrangeWindow.setPendingIndex(-1);
        this._arrangeWindow.redrawItem(index1);

    }

    // Cancels Selection or Exits Arrangement Menu
    Scene_Arrange.prototype.onArrangeCancel = function() {
        if (this._arrangeWindow.pendingIndex() !== -1) 
        {
            this._arrangeWindow.setPendingIndex(-1);
            this._arrangeWindow.activate(); 
        } 
        else 
        {
            this.popScene();
        }
    };

    // Arrangement Window Rectangle Dimensions
    Scene_Arrange.prototype.arrangeWindowRect = function() {
        const ww = 800;
        const wh = this.calcWindowHeight(12, true);
        const wx = (Graphics.boxWidth - ww) / 2;
        const wy = (Graphics.boxHeight - wh) / 2;
        return new Rectangle(wx, wy, ww, wh);
    };

    //
    //--------------------------------------------
    // Create Arrangement Window
    //
    function Window_Arrange() {
        this.initialize(...arguments);
    }

    Window_Arrange.prototype = Object.create(Window_Selectable.prototype);
    Window_Arrange.prototype.constructor = Window_Arrange;

    Window_Arrange.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this._pendingIndex = -1;
        this.refresh();
        this.select(0);
        this.activate();
    };

    Window_Arrange.prototype.maxCols = function() {
        return 3;
    };

    // Draw Grid Items
    Window_Arrange.prototype.maxItems = function() {
        return 9;
    };

    Window_Arrange.prototype.drawPendingItemBackground = function(index) {
        if (index === this._pendingIndex) {
            const rect = this.itemRect(index);
            const color = ColorManager.pendingColor();
            this.changePaintOpacity(false);
            this.contents.fillRect(rect.x, rect.y, rect.width, rect.height, color);
            this.changePaintOpacity(true);
        }
    };

    Window_Arrange.prototype.pendingIndex = function() {
        return this._pendingIndex;
    };

    Window_Arrange.prototype.setPendingIndex = function(index) {
        const lastPendingIndex = this._pendingIndex;
        this._pendingIndex = index;
        this.redrawItem(this._pendingIndex);
        this.redrawItem(lastPendingIndex);
    };

    Window_Arrange.prototype.maxVisibleItems = function() {
        const visibleRows = Math.ceil(this.contentsHeight() / this.itemHeight());
        return visibleRows * this.maxCols();
    };

    Window_Arrange.prototype.drawAllItems = function() {
        const topIndex = this.topIndex();
        for (let i = 0; i < this.maxVisibleItems(); i++) {
            const index = topIndex + i;
            if (index < this.maxItems()) {
                this.drawItemBackground(index);
                this.drawItem(index);
            }
        }
    };

  
    Window_Arrange.prototype.itemHeight = function() {
        return 150;
    };

    Window_Arrange.prototype.drawItem = function(index) {
        // Get element in PARTY_ARRANGEMENT that corresponds with the index
            this.drawPendingItemBackground(index);
        var arranged_actor = $gameParty._PARTY_ARRANGEMENT[index];
        console.log("Drawing Face");

        // If the element is an actor, save and draw its portrait,
        // then assign the actor's Initial Battle Position
        if (arranged_actor != null) {

            var rect = this.itemRect(index);
            this.drawFace(arranged_actor.faceName(), arranged_actor.faceIndex(), rect.x, rect.y, rect.width, rect.height);
            arranged_actor._initBattlePos = index;
            console.log(`${arranged_actor.name()} has had their Arrangement and Initial Battle Position assigned to ${$gameParty._PARTY_ARRANGEMENT.indexOf(arranged_actor)}`)

        }

    };


    //
    //--------------------------------------------
    // Add & Remove Party Members from Arrangment
    //


    // On recruitment, insert Party Member into th first available Arrangement slot
    // and set the corresponding Initial Battle Position
    const _Game_Party_addActor = Game_Party.prototype.addActor;
    Game_Party.prototype.addActor = function(actorId) {
        _Game_Party_addActor.call(this, actorId);

        const actor = $gameActors.actor(actorId);

        for (let i = 0; i < this._PARTY_ARRANGEMENT.length; i++) {
            if (this._PARTY_ARRANGEMENT[i] === null)
            {
                this._PARTY_ARRANGEMENT[i] = actor;
                actor.setBattlePos(i);
                break;
            }
        }

        console.log(`Actor ${actor.name()} was recruited to the Game Party`);
        console.log(`Actor ${actor.name()} has had their Arrangement Slot and Initial Battle Position assigned to ${this._PARTY_ARRANGEMENT.indexOf(actor)}`);

    };

    // On dismissal, remove the Party Member from their Arrangement slot
    const _Game_Party_removeActor = Game_Party.prototype.removeActor;
    Game_Party.prototype.removeActor = function(actorId) {
        _Game_Party_removeActor.call(this, actorId);

        const actor = $gameActors.actor(actorId);

        for (let i = 0; i < this._PARTY_ARRANGEMENT.length; i++) {
            if (this._PARTY_ARRANGEMENT[i] === actor)
            {
                this._PARTY_ARRANGEMENT[i] = null;
                break;                
            }
        }

        
        console.log(`Actor ${actor.name()} was removed from the Game Party`);
        console.log(`Actor ${actor.name()} has been removed from Arrangement Slot ${actor.getBattlePos()}`);

    };

    // Func to set Party Member _initBattlePos on save load based on stored Arrangment data

    //
    //--------------------------------------------
    // Menu command to open Arrangement Window
    //
    const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
    Window_MenuCommand.prototype.addOriginalCommands = function() {
        _Window_MenuCommand_addOriginalCommands.call(this);
        this.addCommand("Arrangement", "arrangement", true);
    };


    //======================================================================================================================================================
    // BATTLE START
    //======================================================================================================================================================

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
        
        // Assign Party Positions
        console.log("Assigning Battle Positions for Player Party")
        for (const actor of $gameParty.battleMembers()) {
            assignBattlerToGrid(PLAYER_GRID, actor, actor.getBattlePos())
        }
        console.log("All Party Members assigned to a Position")


        // Get the first Event Page comment meta-data on the Initial Positions for each Enemy
        const troopInitialPos = getTroopInitBattlePos();

        // Ensure there's an equivalent amount of Enemies and Positions
        if ($gameTroop.members().length != troopInitialPos.length) {
            throw new Error(
                "THERE IS AN UNEQUAL AMOUNT OF ENEMIES AND INITIAL POSITIONS IN THE TROOP"
            );
        }

        // Assign Enemy Positions
        console.log(`Assigning Battle Positions for Troop ${$gameTroop.troop().name}`)
        let i = 0;
        troopInitialPos.forEach(initPos => {
            assignBattlerToGrid(ENEMY_GRID, $gameTroop.members()[i], initPos);
            i++;
        });
        console.log("All Enemies assigned to a Position")

        console.log("Battle Start");
    };

    //======================================================================================================================================================
    // ENEMY SPRITE DATA
    //======================================================================================================================================================

    // Enemies have an array storing three sprites, all null by default:
      // One for Long Distance
      // One for Mid Distance
      // One for Short Distance
    

    // Reference an Enemy's Note Page to get and set their sprites, located in (projectname)/img/enemies
      // (In format: <LD: X, MD: Y, SD: Z>)


    //======================================================================================================================================================
    // BATTLE STATUS WINDOW
    //======================================================================================================================================================

    // 3x3 Grid Corresponding with Player Grid
    // Each Panel is smaller and only shows Party Members' Names, HP, MP, and TBP Gauge

    //======================================================================================================================================================
    // BATTLE
    //======================================================================================================================================================
    
    // Move Battler to another Pos, but reset TBP Gauge to 0
      // If they're swapping with another Battler, reset both their TBP to 0

    // Based on the ScreenX and ScreenY Vars of each Enemy's Position, set their Sprite Image and on-screen location
   
    // If a Battler dies, clear the BattlePos they inhabited in their Grid

    // 'Shift' Button that moves a Party Memberto a new Position, potentially swapping with another

    //======================================================================================================================================================
    // Skills
    //======================================================================================================================================================
    
    // (Range Type, Position Targeting, Damage Fall Off)
      // (Long - 5 Row Ahead, Mid - 3 Row Ahead, Short - 1 Row Ahead?
      // Can use attacks anywhere, but falloff comes in if made at inappropriate Pos
      // ... Rework these details in Combat doc)

    //======================================================================================================================================================
    // ON NEW GAME
    //======================================================================================================================================================

    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function()
    {
        _DataManager_setupNewGame.call(this);
        console.log("New Game");

        const partyMembers = $gameParty.members(); 
        
        for (let i = 0; i < partyMembers.length; i++)
        {
             $gameParty._PARTY_ARRANGEMENT[i] = partyMembers[i];
             console.log("Arranging Starting Party");
        }
    }


})();