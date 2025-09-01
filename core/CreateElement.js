import ElementUtils from "../../DocGuiLib/core/Element"
import ButtonElement from "../../DocGuiLib/elements/Button"
import CheckboxElement from "../../DocGuiLib/elements/Checkbox"
import SliderElement from "../../DocGuiLib/elements/Slider"
import SelectionElement from "../../DocGuiLib/elements/Selection"
import TextDescriptionElement from "../../DocGuiLib/elements/TextDescription"
import TextInputElement from "../../DocGuiLib/elements/TextInput"
import ColorPickerElement from "../../DocGuiLib/elements/ColorPicker"
import SwitchElement from "../../DocGuiLib/elements/Switch"
import DropDown from "../../DocGuiLib/elements/DropDown"
import MultiCheckbox from "../../DocGuiLib/elements/MultiCheckbox"
import Keybind from "../../DocGuiLib/elements/Keybind"
import { AdditiveConstraint, CenterConstraint, CramSiblingConstraint, OutlineEffect, UIRoundedRectangle, UIWrappedText } from "../../Elementa"
import ConfigTypes from "./ConfigTypes"

const maxLinesMethod = UIWrappedText.class.getDeclaredMethod("getMaxLines")
maxLinesMethod.setAccessible(true)

export default class CreateElement {
    /**
     * @param {import("./Category").default} categoryClass
     */
    constructor(categoryClass) {
        // Category class stuff
        this.categoryClass = categoryClass
        this.rightBlock = this.categoryClass.rightBlock
        this.config = this.categoryClass.config
        this.categoryName = this.categoryClass.categoryName
        this.handler = this.categoryClass.handler
        this.sortElement = this.categoryClass.parentClass.sortElements

        // This map holds all of the elements
        this.elements = []

        // Stores all the created [subcategories]
        // maybe later on we store the actual settings of each
        this.subcategories = new Set()
        this.configComps = new Map() // <configName>: component
    }

    /**
     * - Makes a text with description element and adds it to the list of elements
     * and returns the box itself to be used as parent
     * @param {Object} obj 
     * @returns
     */
    _makeTextDescription(obj) {
        const subcategory = obj.subcategory ?? this.categoryClass.categoryName

        if (!this.subcategories.has(subcategory)) {
            this.subcategories.add(subcategory)
            this.categoryClass?._createDivider(subcategory, this.subcategories.size > 1)
        }

        const guiScheme = this.handler.getColorScheme().Amaterasu
        const guiBounds = this.categoryClass.parentClass.AmaterasuGui

        const bgBox = new UIRoundedRectangle(5)
            .setX(new CenterConstraint())
            .setY(new CramSiblingConstraint(5))
            .setWidth((85).percent())
            .setHeight((20).percent())
            .setColor(ElementUtils.getJavaColor(guiScheme.descriptionbackground.color))
            .enableEffect(new OutlineEffect(ElementUtils.getJavaColor(guiScheme.descriptionbackground.outlineColor), guiScheme.descriptionbackground.outlineSize))
            .setChildOf(this.rightBlock)

        // Change text width depending on the [ConfigType] of this element
        const textWidth = obj.type === ConfigTypes.COLORPICKER
            ? 72
            : obj.type === ConfigTypes.TEXTPARAGRAPH
                ? 98
                : 80
        const textWrapping = guiBounds.descriptionElement.textWrap.enabled

        const descElement = new TextDescriptionElement(obj.text, obj.description, obj.centered ?? false, 0, 0, textWidth, 75)
            ._setPosition(
                (guiBounds.descriptionElement.xPadding).percent(),
                new CenterConstraint()
            )
            .setWrapHeight(textWrapping)
        descElement
            ._create(guiScheme)
            .setChildOf(bgBox)

        if (!textWrapping) {
            const lim = maxLinesMethod.invoke(descElement.descriptionElement)
            if (lim > guiBounds.descriptionElement.textWrap.linesLimit) {
                const linesLength = (lim - guiBounds.descriptionElement.textWrap.removeLines)
                bgBox.setHeight(
                    new AdditiveConstraint(
                        (20).percent(),
                        (guiBounds.descriptionElement.textWrap.wrapHeight * linesLength).pixels()
                        )
                    )
            }
        }

        const textScale = descElement._getSchemeValue("text", "scale")
        const textScaleType = guiScheme.Text.text.scaleType
        const isPercent = textScaleType.toLowerCase() === "percent"

        descElement.text.setTextScale((textScale)[isPercent ? "percent" : "pixels"]())
        descElement.descriptionElement.setTextScale((textScale)[isPercent ? "percent" : "pixels"]())

        this.elements.push({ name: obj.name, component: bgBox, configObj: obj, previousComponent: null })

        return bgBox
    }

    /**
     * - Internal use.
     * - Loops through each [Category] and the given config objects
     * - Creates these and adds the elements to the list
     * @returns {Category}
     */
    _create() {
        const configSettings = this.categoryClass.config?.find(obj => obj.category === this.categoryName)?.settings
        if (!configSettings) return

        if (this.sortElement) configSettings.sort(this.sortElement)

        // Start creating the elements based off of the [Object]
        for (let obj of configSettings)
            this._createFromObj(obj)

        // Trigger the hide/unhide of elements
        this._hideElement(this.categoryClass.parentClass.settings)

        // Return the parent class for main method chaining
        return this.categoryClass
    }

    /**
     * - Internal use.
     * - Checks the [Object]'s [ConfigType] and based off of those values it creates
     * - the corresponding element
     * @param {{}} obj 
     */
    _createFromObj(obj) {
        switch (obj.type) {
            case ConfigTypes.TOGGLE:
                return this._addToggle(obj, () => this._handleUpdate(obj, !obj.value))

            case ConfigTypes.SLIDER:
                return this._addSlider(obj, (sliderValue) => {
                    sliderValue = parseFloat(sliderValue)
                    if (isNaN(sliderValue)) return

                    this._handleUpdate(obj, sliderValue)
                })

            case ConfigTypes.BUTTON:
                return this._addButton(obj)

            case ConfigTypes.SELECTION:
                return this._addSelection(obj, (selectionIndex) => {
                    if (typeof selectionIndex !== "number") return
                    
                    this._handleUpdate(obj, selectionIndex)
                })

            case ConfigTypes.TEXTINPUT:
                return this._addTextInput(obj, (inputText) => this._handleUpdate(obj, inputText))

            case ConfigTypes.COLORPICKER:
                return this._addColorPicker(obj, (rgbaArray) => this._handleUpdate(obj, rgbaArray))

            case ConfigTypes.SWITCH:
                return this._addSwitch(obj, () => this._handleUpdate(obj, !obj.value))

            case ConfigTypes.DROPDOWN:
                return this._addDropDown(obj, (dropDownIndex) => this._handleUpdate(obj, dropDownIndex))

            case ConfigTypes.MULTICHECKBOX:
                return this._addMultiCheckbox(obj, (configName, value) => {
                    const actualObj = obj.options.find(it => it.configName === configName)
                    if (!actualObj) return
                    
                    this._handleUpdate(actualObj, value)
                })

            case ConfigTypes.TEXTPARAGRAPH:
                return this._makeTextDescription(obj)

            case ConfigTypes.KEYBIND:
                return this._addKeybind(obj, (keyCode) => this._handleUpdate(obj, keyCode))
        }
    }

    /**
     * - Internal use.
     * - Triggers all the listeners set to the current [Object]'s [configName]
     * - Passing through `(previousValue, newValue)`
     * @param {{}} obj
     * @param {*} value
     * @param {*} newValue
     */
    triggerListeners(obj, value, newValue) {
        const _configListeners = this.categoryClass.parentClass._configListeners

        const name = obj.name

        _configListeners.get(name)?.forEach(it => it(value, newValue, name))
        _configListeners.get(this.categoryClass.parentClass.generalSymbol)?.forEach(it => it(value, newValue, name))
        obj.registerListener?.(value, newValue, name)
    }

    _handleUpdate(obj, newValue) {
        if (Array.isArray(newValue) && obj.value.every((value, index) => value === newValue[index])) return
        else if (obj.value === newValue) return

        let oldValue = obj.value
        obj.value = newValue
        this.categoryClass._updateElement(obj)
        // Avoid triggering the listener BEFORE the object is actually updated
        this.triggerListeners(obj, oldValue, newValue)
    }

    _triggerSoundClick() {
        this.categoryClass.parentClass._onClickSound?.()
    }

    // The following methods do not have jsdocs due to the fact that
    // it's pretty easy to understand what they're doing and pretty much are similar to each other
    // (and yes these are only internal use methods)

    _addToggle(obj, fn) {
        const textDescription = this._makeTextDescription(obj)

        const checkbox = new CheckboxElement(obj.value, 0, 0, 12, 30, true)
            ._setPosition(
                (5).pixel(true),
                new CenterConstraint()
            )
            .onMouseClickEvent(() => {
                this._triggerSoundClick()
                fn()
            })
        checkbox
            ._create(this.handler.getColorScheme())
            .setChildOf(textDescription)
        this.configComps.set(obj.name, checkbox)

        return this
    }

    _addSlider(obj, fn) {
        const textDescription = this._makeTextDescription(obj)

        const slider = new SliderElement(obj.options, obj.value, 0, 0, 15, 30)
            ._setPosition(
                (5).pixel(true),
                new CenterConstraint()
            )
            .onMouseClickEvent(() => {
                this._triggerSoundClick()
            })
            .onMouseReleaseEvent(fn)
        slider
            ._create(this.handler.getColorScheme())
            .setChildOf(textDescription)
        this.configComps.set(obj.name, slider)

        return this
    }

    _addSelection(obj, fn) {
        const textDescription = this._makeTextDescription(obj)

        const selection = new SelectionElement(obj.options, obj.value, 0, 0, 17, 30)
            ._setPosition((5).pixel(true), new CenterConstraint())
            .onMouseClickEvent((idx) => {
                this._triggerSoundClick()
                fn(idx)
            })
        selection
            ._create(this.handler.getColorScheme())
            .setChildOf(textDescription)
        this.configComps.set(obj.name, selection)

        return this
    }

    _addTextInput(obj, fn) {
        const textDescription = this._makeTextDescription(obj)

        const input = new TextInputElement(obj.value, 0, 0, 17, 30)
            .setPlaceHolder(obj.placeHolder)
            ._setPosition((5).pixel(true), new CenterConstraint())
            .onMouseClickEvent(this._triggerSoundClick.bind(this))
            .onKeyTypeEvent(fn)
        input
            ._create(this.handler.getColorScheme())
            .setChildOf(textDescription)
        this.configComps.set(obj.name, input)

        return this
    }

    _addColorPicker(obj, fn) {
        const textDescription = this._makeTextDescription(obj)

        const comp = new ColorPickerElement(obj.value, 0, 0, 17, 30)
            ._setPosition((5).pixel(true), new CenterConstraint())
            .onKeyTypeEvent(fn)

        comp._create(this.handler.getColorScheme())
            .setChildOf(textDescription)

        comp.textInput.onMouseClickEvent(this._triggerSoundClick.bind(this))
        comp.arrowText.onMouseClick(this._triggerSoundClick.bind(this))

        this.configComps.set(obj.name, comp)

        return this
    }

    _addButton(obj) {
        const textDescription = this._makeTextDescription(obj)

        // Making a variable for it so we can set the [onMouseClickEvent] later on
        const button = new ButtonElement(obj.placeHolder, 0, 0, 15, 30, true)
            ._setPosition((5).pixel(true), new CenterConstraint())
            .onMouseClickEvent(() => {
                this._triggerSoundClick()
                obj.onClick?.(this.categoryClass.parentClass)
            })

        button
            ._create(this.handler.getColorScheme())
            .setChildOf(textDescription)

        return this
    }

    _addSwitch(obj, fn) {
        const textDescription = this._makeTextDescription(obj)

        const switchElm = new SwitchElement(obj.value, 0, 0, 12, 30)
            ._setPosition((5).pixel(true), new CenterConstraint())
            .onMouseClickEvent(() => {
                this._triggerSoundClick()
                fn()
            })
        switchElm
            ._create(this.handler.getColorScheme())
            .setChildOf(textDescription)
        this.configComps.set(obj.name, switchElm)

        return this
    }

    _addDropDown(obj, fn) {
        const textDescription = this._makeTextDescription(obj)

        const component = new DropDown(obj.options, obj.value, 0, 0, 20, 35)
            ._setPosition((5).pixel(true), new CenterConstraint())
            .onMouseClickEvent((v) => {
                this._triggerSoundClick()
                fn(v)
            })

        component
            ._create(this.handler.getColorScheme())
            .setChildOf(textDescription)

        const hideFn = () => !component.hidden && component._hideDropDown()
        this.rightBlock
            .onMouseScroll(hideFn.bind(this))
            .onMouseClick(hideFn.bind(this))

        this.categoryClass.parentClass.leftBlock
            .onMouseScroll(hideFn.bind(this))
            .onMouseClick(hideFn.bind(this))

        this._find(obj.name).compInstance = component
        this.configComps.set(obj.name, component)

        return this
    }

    _addMultiCheckbox(obj, fn) {
        const textDescription = this._makeTextDescription(obj)

        // TODO: update dgl to handle the value updates for us
        //  REMEMBER: this one is missing the entire "rebuild" logic

        const component = new MultiCheckbox(obj.options, obj.placeHolder, 0, 0, 20, 35)
            ._setPosition((5).pixel(true), new CenterConstraint())
            .onMouseClickEvent((configName, value) => {
                this._triggerSoundClick()
                fn(configName, value)
            })

        component
            ._create(this.handler.getColorScheme())
            .setChildOf(textDescription)

        const hideFn = () => !component.hidden && component._hideDropDown()
        this.rightBlock
            .onMouseScroll(hideFn.bind(this))
            .onMouseClick(hideFn.bind(this))

        this.categoryClass.parentClass.leftBlock
            .onMouseScroll(hideFn.bind(this))
            .onMouseClick(hideFn.bind(this))

        this._find(obj.name).compInstance = component

        for (let entry of Object.entries(component.checkboxes))
            this.configComps.set(entry[0], entry[1])

        return this
    }

    _addKeybind(obj, fn) {
        const textDescription = this._makeTextDescription(obj)

        const comp = new Keybind(obj.value, 0, 0, 15, 30)
            ._setPosition((5).pixel(true), new CenterConstraint())
            .onKeyTypeEvent(fn)

        comp._create(this.handler.getColorScheme())
            .setChildOf(textDescription)

        comp.bgbox.onMouseClick(this._triggerSoundClick.bind(this))
        this.configComps.set(obj.name, comp)

        return this
    }

    /**
     * - Hide/Unhide the element depending on the [shouldShow] method result
     */
    _hideElement(data) {
        if (this.categoryClass.selected) {
            for (let idx = 0; idx < this.elements.length; idx++) {
                let obj = this.elements[idx]

                if (!obj.configObj.shouldShow) continue
                if (idx !== 0) obj.previousComponent = this.elements[idx - 1].component

                let isEnabled = obj.configObj.shouldShow(data)
                if (typeof isEnabled === "object") throw `[Amaterasu] Error while attempting to check for shouldShow. ${obj.configObj.shouldShow} does not return a valid Boolean`
                
                let component = obj.component
                if (!isEnabled) {
                    this._hide(component)
                    if (obj.compInstance && !obj.compInstance.hidden) obj.compInstance._hideDropDown()
                    continue
                }

                this._unhide(component, idx)
            }
        }

        this.categoryClass.parentClass._triggerShouldShowCategory()
    }

    /**
     * - Internal use.
     * - Hides all the [DropDown] components if they're currently shown.
     */
    _hideDropDownComps() {
        for (let obj of this.elements)
            obj.compInstance?._hideDropDown()
    }

    /**
     * - Internal use
     * - Fixed version to my needs of Elementa's `#hide` method
     * @param {*} component 
     * @returns 
     */
    _hide(component) {
        if (!component) return

        const parent = component.parent
        const compIdx = parent?.children?.indexOf(component)

        // If the [child] doesn't exist already we return
        if (compIdx === -1) return

        // Remove the [child] from the [parent]
        parent.removeChild(component)
    }
    
    /**
     * - Internal use
     * - Fixed version to my needs of Elementa's `#unhide` method
     * @param {*} component
     * @param {*} idx
     * @returns 
     */
    _unhide(component, idx) {
        if (!component) return

        const prevComponent = this._findPreviousComponent(idx)
        const parent = prevComponent?.parent
        const children = parent?.children
        const previousIdx = children?.indexOf(prevComponent)
        const compIdx = children?.indexOf(component)

        // If the [previousChild] doesn't exist we return
        // or if the [currentChild] is already set we return
        if (previousIdx === -1 || compIdx !== -1) return

        parent.insertChildAt(component, previousIdx + 1)
    }

    /**
     * - Internal use
     * - Finds the element inside this class's [elements] array
     * @param {String} name 
     * @returns {Object|null}
     */
    _find(name) {
        // i promise i'm not lazy i just work smart
        return this.elements.find(it => it.name === name)
    }

    /**
     * - Internal use.
     * - Finds the previous component doing a backwards search through the list with the starting point
     * - The starting point being the given index
     * @param {number} start The starting point the `for..loop` will take
     * @returns {UIComponent?}
     */
    _findPreviousComponent(start) {
        while (start--) {
            let comp = this.elements?.[start]?.previousComponent
            let compIdx = comp?.parent?.children?.indexOf(comp)

            if (compIdx !== -1) return comp
        }
    }

    shouldShow() {
        // TODO: possibly find a better way to link components together
        this._hideElement(this.categoryClass.parentClass.settings)
    }
}