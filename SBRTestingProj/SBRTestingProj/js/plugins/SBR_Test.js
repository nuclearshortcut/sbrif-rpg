/*:
* @target MZ
* @plugindesc A test plugin for SBRif... that increases character sprint
* @author setsuna04
*
* @help
* This plugin is for testing purposes.
*
* @param superSprintSpeed
* @desc Player Character super sprint speed
* @type number
* @default 10
*
* @param enableSuperSprint
* @desc enables super sprint
* @type boolean
* @default false
*
*/

(() => {

    const pluginName = "SBR_Test";
    const parameters = PluginManger.parameters(pluginName);

    const superSprintSpeed = Number(parameters["superSprintSpeed"]);

    const enabled = Boolean(parameters["enableSuperSprint"] === "true");

    const disabled = Boolean(parameters["disableSuperSprint"] === "false");


})();