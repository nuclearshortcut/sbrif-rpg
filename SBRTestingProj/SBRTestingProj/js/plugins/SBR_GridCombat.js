/*:
* @target MZ
* @plugindesc A combat modification for SBRif... that attaches a grid-based positioning system to Combat
* @author setsuna04
*
*
*
*/

const pluginName = "SBR_GridCombat";
const parameters = PluginManger.parameters(pluginName);

(() => {

    const pluginName = "SBR_Test";
    const parameters = PluginManger.parameters(pluginName);

    // Battle Positions
    class BattlePos {
        constructor(distance, lane) {
            this.distance = distance;
            this.lane = lane;
            this.battler = null;
        }
    }

    // For enemies, consider screenX and screenY position for all Positions
    class EnemyBattlePos extends BattlePos{
        constructor(distance, lane, screenX, screenY) {
           super(distance, lane);
           this.screenX = screenX;
           this.screenY = screenY
           this.battler = null;
        }
    }
    
    // The Player Side and the Enemy Side each have a set of NINE Positions 
    // where Battlers are stored and can move between
    const SHORT_LEFT_P = new BattlePos("SHORT", "LEFT")
    const SHORT_CENTER_P = new BattlePos("SHORT", "CENTER")
    const SHORT_RIGHT_P = new BattlePos("SHORT", "RIGHT")
    const MID_LEFT_P = new BattlePos("MID", "LEFT")
    const MID_CENTER_P = new BattlePos("MID", "CENTER")
    const MID_RIGHT_P = new BattlePos("MID", "RIGHT")
    const LONG_LEFT_P = new BattlePos("LONG", "LEFT")
    const LONG_CENTER_P = new BattlePos("LONG", "CENTER")
    const LONG_RIGHT_P = new BattlePos("LONG", "RIGHT")

    const SHORT_LEFT_E = new EnemyBattlePos("SHORT", "LEFT", 0, 0)
    const SHORT_CENTER_E = new EnemyBattlePos("SHORT", "CENTER", 0, 0)
    const SHORT_RIGHT_E = new EnemyBattlePos("SHORT", "RIGHT", 0, 0)
    const MID_LEFT_E = new EnemyBattlePos("MID", "LEFT", 0, 0)
    const MID_CENTER_E = new EnemyBattlePos("MID", "CENTER", 0, 0)
    const MID_RIGHT_E = new EnemyBattlePos("MID", "RIGHT", 0, 0)
    const LONG_LEFT_E = new EnemyBattlePos("LONG", "LEFT", 0, 0)
    const LONG_CENTER_E = new EnemyBattlePos("LONG", "CENTER", 0, 0)
    const LONG_RIGHT_E = new EnemyBattlePos("LONG", "RIGHT", 0, 0)
    
    const PLAYER_POS = [SHORT_LEFT_P, SHORT_CENTER_P, SHORT_RIGHT_P,
                        MID_LEFT_P, MID_CENTER_P, MID_RIGHT_P,
                        LONG_LEFT_P, LONG_CENTER_P, MID_RIGHT_P]


    const ENEMY_POS = [SHORT_LEFT_E, SHORT_CENTER_E, SHORT_RIGHT_E,
                        MID_LEFT_E, MID_CENTER_E, MID_RIGHT_E,
                        LONG_LEFT_E, LONG_CENTER_E, MID_RIGHT_E]


    // Every Battler now has an ActiveBattlePos where they'll be placed at the start of Combat.
    // The initial BattlePos is considered its starting BattlePos
    const _Game_Battler_initMembers = Game_Battler.prototype.initMembers;

    Game_Battler_initMembers.prototype.initMembers = function() {
        _Game_Battler_initMembers.call(this);

        this._activeBattlePos = null;
    }

    // Setter func for Battler BattlePos
    Game_Battler.prototype.setActiveBattlePos = function (newValue) {
        if (newValue instanceof BattlePos || newValue === null)
        {
            this._activeBattlePos = newValue;
        }
        else
        {
            console.warn("Var of incorrect type assigned to Battler's BattlePos")
        }

    }

    // Every Enemy Battler should also have a sprite for each potential Distance (Do NOT modify Actors. Modify Enemies EXCLUSIVELY)
    // Keep track of and change Enemy Sprites in accordance to their Position

    // When an Enemy Battler dies, its BattlePos should clear itself

    // Change Enemy Battler sprite based on current Distance

    // On Battle end, ENEMY_POS should clear all BattlePos of Battlers
    
    // Function to move a Battler to a BattlePos


    // Function to swap to Battlers' BattlePos
    

    // Metadata reading


})();