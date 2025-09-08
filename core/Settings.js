import ElementUtils from "../../DocGuiLib/core/Element"
import HandleGui from "../../DocGuiLib/core/Gui"
import MarkdownElement from "../../DocGuiLib/elements/Markdown"
import SearchElement from "./Search"
import { CenterConstraint, CramSiblingConstraint, OutlineEffect, ScrollComponent, UIRoundedRectangle, UIText, Window } from "../../Elementa"
import Category from "./Category"
import { CustomGui } from "../../DocGuiLib/core/CustomGui"
import HandleRegisters from "../../DocGuiLib/listeners/Registers"

// Credits to @unclaimedbloom6 (big thank)
const mergeObjects = (obj1, obj2, final = {}) => {
    // Add the keys from the first object
    for (let entry of Object.entries(obj1)) {
        let [k, v] = entry
        final[k] = v
    }

    // Add the keys from the second object
    for (let entry of Object.entries(obj2)) {
        let [k, v] = entry
        // Key was already added from the first object
        if (k in final) {
            // Go a level deeper if this is an object
            if (typeof v === "object" && !Array.isArray(v)) {
                final[k] = mergeObjects(obj1[k], v)
            }
            continue
        }

        // Key didn't already exist, write it
        final[k] = v
    }

    return final
}

/**
 * @template {import("./DefaultConfig").default} T
 * @typedef {T extends import("./DefaultConfig").default<infer U, any, any, any> ? U : never} GetTypeP
 */
/**
 * @template {import("./DefaultConfig").default} T
 * @typedef {T extends import("./DefaultConfig").default<any, infer U, any, any> ? U : never} GetTypeC
 */
/**
 * @template {import("./DefaultConfig").default} T
 * @typedef {T extends import("./DefaultConfig").default<any, any, infer U, any> ? U : never} GetTypeA
 */
/**
 * @template {import("./DefaultConfig").default} T
 * @typedef {T extends import("./DefaultConfig").default<any, any, any, infer U> ? U : never} GetTypeL
 */

/**
 * @template {import("./DefaultConfig").default} DefaultConfig
 */
export default class Settings {
    /**
     * @param {string} moduleName
     * @param {DefaultConfig} defaultConfig
     * @param {string} colorSchemePath
     * @param {string?} titleText
     */
    constructor(moduleName, defaultConfig, colorSchemePath, titleText) {
        // Module variables
        this.moduleName = moduleName
        /** @type {DefaultConfig} */
        this.defaultConfig = defaultConfig
        this.colorSchemePath = colorSchemePath || "data/ColorScheme.json"
        this.colorScheme = this._checkScheme(this.colorSchemePath)

        // Gui Listener Handler
        this.handler = new HandleGui()._setColorScheme(this.colorScheme)

        // Rebuild handler with new Custom Gui in DocGuiLib
        this.handler.ctGui = new CustomGui()
        this.handler.window = new Window()
        this.handler.registers = new HandleRegisters(this.handler.ctGui, this.handler.window)
        this.handler.registers.isCustom = true

        // Save window size to fix text-wrapping issue
        this._startedWidth = Renderer.screen.getWidth() * Renderer.screen.getScale()
        this._startedHeight = Renderer.screen.getHeight() * Renderer.screen.getScale()

        this.titleText = (titleText ?? `${this.moduleName} Settings`).addColor()
        this.sortCategories = null
        this.sortElements = null
        this.GuiScale = null

        // Listeners
        this._onOpenGui = []
        this._onCloseGui = []
        this._configListeners = new Map()
        this.generalSymbol = Symbol("all")

        // Config variables
        // Set this so we can actually have the [settings] field auto update
        // Rather than having to use a function to return its newly defined value
        this.defaultConfig.settingsInstance = this
        this.configsClass = this.defaultConfig._init() // keeping the same name because too lazy to find where else i use it
        this.config = this.configsClass.config
        /**
         * @type {ReturnType<DefaultConfig["_initSettings"]>}
         */
        this.settings = this.configsClass._initSettings()

        // Categories variables
        this.categories = new Map()
        this.currentCategory = null
        this.oldCategory = null
        this.markdowns = []
        this._hideCategory = {}

        // Enable repeat keys so people can hold down keys to type now
        this.handler.ctGui
            .registerInit(() => Keyboard.enableRepeatEvents(true))
            .registerResize(this._checkResize.bind(this))

        this.handler.registers
            .onOpen(() => {
                this._checkResize()

                // Trigger listeners
                for (let fn of this._onOpenGui) 
                    fn()

                const gameSettings = Client.getMinecraft()./* gameSettings */field_71474_y
                if (gameSettings./* guiScale */field_74335_Z === 2) return

                // Save previous [GuiScale]
                this.GuiScale = gameSettings./* guiScale */field_74335_Z
                // Set [Normal] [GuiScale]
                gameSettings./* guiScale */field_74335_Z = 2
            })
            .onClose(() => {
                // Disable repeating keys so it doesn't leak to the main game
                Keyboard.enableRepeatEvents(false)

                for (let entry of this.categories)
                    entry[1]?.createElementClass?._hideDropDownComps()

                // Trigger listeners
                for (let fn of this._onCloseGui)
                    fn()

                if (this.GuiScale === null || this.GuiScale === 2) return

                const gameSettings = Client.getMinecraft()./* gameSettings */field_71474_y
                if (gameSettings./* guiScale */field_74335_Z !== 2) return

                gameSettings./* guiScale */field_74335_Z = this.GuiScale
                this.GuiScale = null
            })

        // Drawing variables
        /**
         * - This should be used to edit certain aspects of this [Amaterasu] instance's [Gui]
         */
        this.AmaterasuGui = {
            /**
             * - The background (main background) of this [Gui]
             */
            background: {
                /**
                 * @type {number}
                 * - Sets the X position for the background in percent
                 * - Defaults to `20`
                 */
                x: 20,
                /**
                 * @type {number}
                 * - Sets the Y position for the background in percent
                 * - Defaults to `20`
                 */
                y: 20,
                /**
                 * @type {number}
                 * - Sets the width for the background in percent
                 * - Defaults to `60`
                 */
                width: 60,
                /**
                 * @type {number}
                 * - Sets the height for the background in percent
                 * - Defaults to `50`
                 */
                height: 50
            },
            /** 
             * @type {number}
             * - The scrollbar size (`width`) in pixels
             * - Defaults to `5` pixels
             */
            scrollbarSize: 5,
            /** 
             * - Holds size and position for the searchbar
             */
            searchBar: {
                /**
                 * @type {number}
                 * - Sets the X position for the searchBar in percent
                 * - Defaults to `68.4`
                 */
                x: 68.4,
                /**
                 * @type {number}
                 * - Sets the Y position for the searchBar in percent
                 * - Defaults to `1.5`
                 */
                y: 1.5,
                /**
                 * @type {number}
                 * - Sets the width for the searchBar in percent
                 * - Defaults to `15`
                 */
                width: 15,
                /**
                 * @type {number}
                 * - Sets the height for the searchBar in percent
                 * - Defaults to `5`
                 */
                height: 5
            },
            /** - The entire descriptionElement component (aka where the setting, title and description go) */
            descriptionElement: {
                /**
                 * @type {number}
                 * - Sets the xPadding in percent
                 * - Defaults to `1.5`
                 */
                xPadding: 1.5,
                /**
                 * - Holds data needed for description text wrapping
                 */
                textWrap: {
                    /** 
                     * - Whether or not to wrap the text
                     * - Disable this if you want the description background box to
                     * auto adjust with the description text height
                     * - Defaults to `true`
                     * @type {boolean}
                     */
                    enabled: true,
                    /**
                     * - Base lines height
                     * - Used to multiply this value by the extra lines and add
                     * to the background box
                     * - Defaults to `7`
                     * - Note: only used whenever `textWrap.enabled` is set to `false`
                     * @type {number}
                     */
                    wrapHeight: 7,
                    /**
                     * - Max lines limit (for text wrapping vertically)
                     * - Used to detection whether the description background box
                     * should change height
                     * - Defaults to `2`
                     * - Note: only used whenever `textWrap.enabled` is set to `false`
                     * @type {number}
                     */
                    linesLimit: 2,
                    /**
                     * - Lines to remove on the calculation for the new height of the description component
                     * - Defaults to `1`
                     * - Note: only used whenever `textWrap.enabled` is set to `false`
                     * @type {number}
                     */
                    removeLines: 1
                }
            },
            /**
             * - Calls the main instance's `apply` method
             * @returns {this}
             */
            apply: this.apply.bind(this)
        }

        this._onClickSound = null

        // Init function
        this._init()
    }

    /**
     * - Sets the command to open this gui
     * @param {string} name
     * @param {string[]} aliases
     * @returns {this} this for method chaining
     */
    setCommand(name, aliases = []) {
        this.handler.setCommand(name, aliases)

        return this
    }

    /**
     * - Function to be ran whenever the config gui attempts to sort the categories
     * - The object is passed through the function
     * - (e.g "obj" would be a param so you can then do "obj.category" for its category name)
     * - NOTE: this function should return [-1, 0, 1]
     * @param {(a: import("./DefaultConfig").DefaultDefaultObject, b: import("./DefaultConfig").DefaultDefaultObject) => number} fn
     * @returns {this} this for method chaining
     * @see {@link apply}
     */
    setCategorySort(fn) {
        if (typeof fn !== "function") throw `[Amaterasu] "${fn}" is not a valid function`
        this.sortCategories = fn

        return this
    }

    /**
     * - Function to be ran whenever [CreateElement] attempts to sort the config components
     * - The object is passed through the function
     * - (e.g "obj" would be a param so you can then do "obj.value" for its value)
     * - NOTE: this function should return [-1, 0, 1]
     * @param {(a: import("./DefaultConfig").DefaultDefaultObject, b: import("./DefaultConfig").DefaultDefaultObject) => number} fn
     * @returns {this} this for method chaining
     * @see {@link apply}
     */
    setElementSort(fn) {
        if (typeof fn !== "function") throw `[Amaterasu] "${fn}" is not a valid function`
        this.sortElements = fn

        return this
    }

    /**
     * - Sets the starting x and y value of the gui (in percent)
     * @param {number} x
     * @param {number} y
     * @returns {this} this for method chaining
     * @see {@link apply}
     */
    setPos(x, y) {
        if (typeof x !== typeof y || Math.min(x, y) < 0) throw `[Amaterasu] Cannot set position to non-negative numbers <x: ${x}, y: ${y}>`

        this.AmaterasuGui.background.x = x
        this.AmaterasuGui.background.y = y

        return this
    }

    /**
     * - Sets the width and height of the gui (in percent)
     * @param {number} width
     * @param {number} height
     * @returns {this} this for method chaining
     * @see {@link apply}
     */
    setSize(width, height) {
        if (typeof width !== typeof height || Math.min(width, height) < 0) throw `[Amaterasu] Cannot set width/height to non-negative numbers <width: ${width}, height: ${height}>`

        this.AmaterasuGui.background.width = width
        this.AmaterasuGui.background.height = height

        return this
    }

    /**
     * @param {string} colorSchemePath
     * @returns {this} this for method chaining
     * @see {@link apply}
     */
    setScheme(newPath) {
        this.colorSchemePath = newPath

        this.colorScheme = this._checkScheme(this.colorSchemePath)
        this.handler._setColorScheme(this.colorScheme)

        return this
    }

    /**
     * - Sets the new config value of the given [configName]
     * - to the passed [value], then calls the `apply` method to update this window
     * @template {keyof GetTypeA<DefaultConfig>} CategoryName
     * @template {keyof GetTypeA<DefaultConfig>[CategoryName]} ConfigName
     * @param {CategoryName} category
     * @param {ConfigName} configName
     * @param {GetTypeA<DefaultConfig>[CategoryName][ConfigName]} value
     * @returns {this} this for method chaining unless errors
     */
    setConfigValue(category, configName, value) {
        if (!category || !this.categories.has(category)) throw `[Amaterasu] No category called "${category}" exists here`
        if (!configName) throw `[Amaterasu] Cannot have configName "${configName}"`

        const catSettings = this.config.find(it => it.category === category)?.settings
        if (!catSettings) throw `[Amaterasu] Cannot find category "${category}"`

        let tempObj
        const configObj = 
            catSettings.find(it => it.name === configName) 
            ?? /* Multicheckbox logic */ (catSettings.some(it => tempObj ??= it.options?.find(n => n.configName === configName)) && tempObj)

        if (!configObj) throw `[Amaterasu] Cannot find configName or option "${configName}" in category "${category}"`

        const createElm = this.categories.get(category)?.createElementClass
        const newValue = createElm?.configComps?.get(configName)?.setValue(value) ?? /* coerce nullish as null */ null
        const oldValue = configObj.value

        if (newValue === null) throw `[Amaterasu] Cannot get component "${configName}" from "${category}" element class, or ${value} cannot be set`

        configObj.value = newValue
        this.configsClass._normalizeSettings(this.settings)
        createElm?.shouldShow()

        // Trigger listener
        const editedName = configObj.name ?? configObj.configName

        const configListeners = this._configListeners

        configListeners.get(editedName)?.forEach(it => it(oldValue, newValue, editedName))
        configListeners.get(this.generalSymbol)?.forEach(it => it(oldValue, newValue, editedName))
        if (configObj.registerListener) configObj.registerListener(oldValue, newValue, editedName)

        return this
    }

    /**
     * - Sets the callback function to be ran whenever certain components get clicked
     * @param {() => void} cb 
     * @returns {this} this for method chaining
     */
    setClickSound(cb) {
        if (typeof cb !== "function") throw `[Amaterasu] "${cb}" is not a valid function`
        this._onClickSound = cb

        return this
    }

    /**
     * - Adds a callback function that is ran whenever a config value changes and/or apply is called
     * to check whether the specified [category] should be hidden or not
     * @template {keyof GetTypeA<DefaultConfig>} CategoryName
     * @param {CategoryName} categoryName
     * @param {(Settings) => boolean} cb
     * @returns {this} this for method chaining
     */
    setCategoryCb(categoryName, cb) {
        this._hideCategory[categoryName] = cb
        this.categories.get(categoryName)?._setShouldShow(cb)

        return this
    }

    /**
     * - Adds a [Changelog] section with the given string
     * - Equivalent to `.addMarkdown("Changelog", text)`
     * @param {string} text
     * @returns {this} this for method chaining
     */
    addChangelog(text) {
        return this.addMarkdown("Changelog", text)
    }

    /**
     * - Adds a markdown category
     * @param {string} category
     * @param {string|string[]} text
     * @returns {this} this for method chaining
     */
    addMarkdown(category, text, _internal = false) {
        if (Array.isArray(text)) text = text.join("\n")

        if (!_internal) this.markdowns.push([category, text])

        const markdownCategory = new Category(this, category, false, false)
        new MarkdownElement(text, 0, 0, 85, 85)
            ._setPosition(
                new CenterConstraint(),
                new CramSiblingConstraint(5)
            )
            ._create(this.handler.getColorScheme())
            .setChildOf(markdownCategory.rightBlock)

        this.categories.set(category, markdownCategory)

        return this
    }

    /**
     * - Gets this [Settings] CT Gui
     * @returns {Gui} the CT Gui
     */
    getGui() {
        return this.handler.ctGui
    }

    /**
     * - Gets this [Settings] HandleGui
     * @see "DocGuiLib/core/Gui.js"
     * @returns {HandleGui} the HandleGui created from DocGuiLib
     */
    getHandler() {
        return this.handler
    }

    /**
     * - Opens this [Settings] Gui
     * @returns {this} this for method chaining
     */
    openGui() {
        this.handler.ctGui.open()

        return this
    }

    /**
     * - Closes this [Settings] Gui
     * @returns {this} this for method chaining
     */
    closeGui() {
        this.handler.ctGui.close()

        return this
    }

    /**
     * - Triggers the given function whenever this [GUI] is opened
     * @param {() => void} fn
     * @returns {this} this for method chaining
     */
    onOpenGui(fn) {
        if (typeof fn !== "function") throw `[Amaterasu] "${fn}" is not a valid function.`
        this._onOpenGui.push(fn)

        return this
    }

    /**
     * - Triggers the given function whenever this [GUI] is closed
     * @param {() => void} fn
     * @returns {this} this for method chaining
     */
    onCloseGui(fn) {
        if (typeof fn !== "function") throw `[Amaterasu] "${fn}" is not a valid function.`
        this._onCloseGui.push(fn)

        return this
    }

    /**
     * - Runs the given function whenever the configName changes value
     * - the function will receive the args `(previousValue, newValue, configName)`
     * @template {keyof GetTypeP<DefaultConfig>} ConfigName
     * @overload
     * @param {ConfigName} configName
     * @param {(previousValue: GetTypeP<DefaultConfig>[ConfigName], newValue: GetTypeP<DefaultConfig>[ConfigName], name: ConfigName) => void} fn
     * @returns {this} this for method chaining
     */
    /**
     * - Runs the given function whenever any config changes value
     * - the function will receive the args `(previousValue, newValue, configName)`
     * @overload
     * @param {(previousValue: import("./DefaultConfig").DefaultObjectValue, newValue: import("./DefaultConfig").DefaultObjectValue, name: string) => void} configName
     * @returns {this} this for method chaining
     */
    registerListener(configName, fn) {
        if (!configName) throw `[Amaterasu] "${configName}" is not a valid config name.`
        if (typeof configName === "function") {
            fn = configName
            configName = this.generalSymbol
        }
        if (typeof fn !== "function") throw `[Amaterasu] "${fn}" is not a valid function.`

        if (!this._configListeners.has(configName)) this._configListeners.set(configName, [])

        this._configListeners.get(configName).push(fn)

        return this
    }

    /**
     * - Redirects the current category to the given one
     * - if a `configName` was given it will try to find it and scroll towards it
     * @template {keyof GetTypeC<DefaultConfig>} CategoryName
     * @param {CategoryName} categoryName
     * @param {?keyof GetTypeC<DefaultConfig>[CategoryName]} configName
     * @returns {this} this for method chaining
     */
    redirect(categoryName, configName = null) {
        const categoryInstance = this.categories.get(categoryName)
        if (!categoryInstance) throw `[Amaterasu] "${categoryName}" is not a valid category name.`

        // Reset the state of all the categories
        for (let entry of this.categories)
            entry[1]._setSelected(false)

        // Set the new category's state
        this.oldCategory = null
        this.currentCategory = categoryName

        // Update the state of the given categoryName
        this.categories.get(this.currentCategory)._setSelected(true)

        if (configName) {
            Client.scheduleTask(2, () => {
                const rightBlock = categoryInstance.rightBlock
                const comp = categoryInstance?.createElementClass?._find(configName)?.component
                if (!comp) return

                const newY = rightBlock.getTop() - comp.getTop()
                categoryInstance.rightBlock.scrollTo(0, newY, true)
            })
        }

        return this
    }

    /**
     * - Applies the changes made to the [SettingsGui]
     * - (e.g you called #setSize you'd have to call `apply()` at the end)
     * @returns {this} this for method chaining
     */
    apply() {
        this.oldCategory = null

        for (let entry of this.categories) 
            entry[1]._delete()

        this.handler.getWindow().clearChildren()
        this._init()

        for (let md of this.markdowns) 
            this.addMarkdown(md[0], md[1], true)

        return this
    }

    /** @private */
    _init() {
        const guiScheme = this.handler.getColorScheme().Amaterasu
        const guiBounds = this.AmaterasuGui

        this.mainBlock = new UIRoundedRectangle(guiScheme.background.roundness)
            .setX((guiBounds.background.x).percent())
            .setY((guiBounds.background.y).percent())
            .setWidth((guiBounds.background.width).percent())
            .setHeight((guiBounds.background.height).percent())
            .setColor(ElementUtils.getJavaColor(guiScheme.background.color))
            .enableEffect(new OutlineEffect(ElementUtils.getJavaColor(guiScheme.background.outlineColor), guiScheme.background.outlineSize))

        this.title = new UIText(this.titleText)
            .setX(new CenterConstraint())
            .setY((3).percent())
            .setTextScale((guiScheme.title.scale).pixels())
            .setColor(ElementUtils.getJavaColor(guiScheme.title.color))
            .setChildOf(this.mainBlock)

        this.searchBarBg = new UIRoundedRectangle(3)
            .setX((guiBounds.searchBar.x).percent())
            .setY((guiBounds.searchBar.y).percent())
            .setWidth((guiBounds.searchBar.width).percent())
            .setHeight((guiBounds.searchBar.height).percent())
            .setColor(ElementUtils.getJavaColor([0, 0, 0, 0]))
            .setChildOf(this.mainBlock)

        this.topLine = new UIRoundedRectangle(3)
            .setX((0.5).percent())
            .setY(new CramSiblingConstraint(5))
            .setWidth((99).percent())
            .setHeight((guiScheme.line.size).percent())
            .setColor(ElementUtils.getJavaColor(guiScheme.line.color))
            .enableEffect(new OutlineEffect(ElementUtils.getJavaColor(guiScheme.line.outlineColor), guiScheme.line.outlineSize))
            .setChildOf(this.mainBlock)

        this.leftBlockBg = new UIRoundedRectangle(3)
            .setX((0.75).percent())
            .setY(new CramSiblingConstraint(5))
            .setWidth((18).percent())
            .setHeight((87).percent())
            .setColor(ElementUtils.getJavaColor(guiScheme.panel.leftColor))
            .setChildOf(this.mainBlock)

        this.leftBlock = new ScrollComponent("No elements...", 5.0)
            .setX((1).percent())
            .setY((1).percent())
            .setWidth((98).percent())
            .setHeight((98).percent())
            .setChildOf(this.leftBlockBg)

        this.leftBlockScrollbar = new UIRoundedRectangle(3)
            .setX((3).pixels(true))
            .setWidth((guiBounds.scrollbarSize).pixels())
            .setColor(ElementUtils.getJavaColor(guiScheme.scrollbar.color))
            .setChildOf(this.leftBlockBg)

        this.leftBlock.setScrollBarComponent(this.leftBlockScrollbar, true, false)

        this.mainRightBlock = new UIRoundedRectangle(3)
            .setX(new CramSiblingConstraint(5))
            .setY(new CramSiblingConstraint(5))
            .setWidth((70).percent())
            .setHeight((87).percent())
            .setColor(ElementUtils.getJavaColor(guiScheme.panel.rightColor))
            .setChildOf(this.mainBlock)

        this.searchBar = new SearchElement(this)

        this.handler.draw(this.mainBlock, false)

        if (this.sortCategories) this.config.sort(this.sortCategories)

        for (let idx = 0; idx < this.config.length; idx++) {
            let categoryName = this.config[idx].category

            let categoryClass = new Category(this, categoryName, idx === 0, true)
                .createElementClass._create()
                ._setShouldShow(this._hideCategory[categoryName])
                
            categoryClass.shouldShow()

            this.categories.set(categoryName, categoryClass)
        }
    }

    /**
     * - Checks whether the color scheme exists and if it doesn't it creates
     * a new one using the path and the default color scheme from the module
     * @private
     * @param {string} moduleName
     * @param {string} path
     * @returns {object}
     */
    _checkScheme(path) {
        const mainDefaultScheme = JSON.parse(FileLib.read("DocGuiLib", "data/DefaultColors.json"))
        let defaultScheme = JSON.parse(FileLib.read("Amaterasu", "data/_DefaultScheme.json"))
        let colorScheme = JSON.parse(FileLib.read(this.moduleName, path)) ?? defaultScheme

        if (colorScheme?.Amaterasu?.backgroundBox) {
            const oldSchemePath = `${path.replace(/\.json/, "")}_old.json`
            console.warn(`[Amaterasu - ${this.moduleName}] Old scheme system detected, your old scheme has been saved as ${oldSchemePath}`)

            this._saveScheme(oldSchemePath, colorScheme)
            // Reset values since we need it to be a clean new object
            colorScheme = {}
        }

        defaultScheme = mergeObjects(defaultScheme, mainDefaultScheme)
        colorScheme = mergeObjects(colorScheme, defaultScheme)

        this._saveScheme(path, colorScheme)

        return colorScheme
    }

    /**
     * - Checks whether it should hide the previous category or not
     * this is to prevent them both being rendered at the same time
     * @private
     */
    _checkCategories() {
        let selectedAmount = 0

        for (let entry of this.categories) {
            // Ensure that the amount of selected components variables
            // set to true is more than 1
            if (entry[1]?.selected) selectedAmount++
            if (selectedAmount < 1) continue

            // Gets the old category's class to disable it
            let oldCategoryClass = this.categories.get(this.oldCategory)

            // Disable the old category (aka just hide it)
            oldCategoryClass?._setSelected(false)
            this.searchBar._hide()

            // Set this key as the old category
            this.oldCategory = entry[0]
            // Reset to default values
            selectedAmount = 0
        }
    }

    /**
     * - Checks whether the screen has changed in size since last time
     * - If it has we rebuild the entire UI
     * - This isn't very efficient but due to the very nature of Amaterasu
     * it has to be done this way
     * @private
     */
    _checkResize() {
        if (
            this._startedWidth !== (Renderer.screen.getWidth() * Renderer.screen.getScale()) ||
            this._startedHeight !== (Renderer.screen.getHeight() * Renderer.screen.getScale())
        ) {
            // Window size changed since last time we were created
            // This means text-wrap might look weird so we need to rebuild the gui
            // This is not really that optimal since it's changing the size only but
            // due to the nature of how Amaterasu works it has to be done this way
            this.apply()

            // Set new size so we don't constantly rebuild
            this._startedWidth = Renderer.screen.getWidth() * Renderer.screen.getScale()
            this._startedHeight = Renderer.screen.getHeight() * Renderer.screen.getScale()
        }
    }

    /**
     * - Hides all of the categories
     * - Currently only used by [SearchBar]
     * @private
     */
    _hideAll() {
        for (let entry of this.categories) 
            entry[1]._setSelected(false)

        this.searchBar._addSlider()
    }

    /**
     * - Unhide the previously selected category
     * - Currently only used by [SearchBar]
     * @private
     */
    _unhideAll() {
        this.categories.get(this.currentCategory)._setSelected(true)

        this.searchBar.searchBar.textInput.releaseWindowFocus()
        this.searchBar._removeSlider()

        this.apply()
    }

    /**
     * - Saves the json color scheme into the given path
     * @private
     * @param {string} path
     * @param {object} json
     */
    _saveScheme(path, json) {
        FileLib.write(
            this.moduleName,
            path,
            JSON.stringify(json, null, 4),
            true
        )
    }

    /** @private */
    _triggerShouldShowCategory() {
        for (let entry of this.categories) 
            entry[1].shouldShow()
    }
}