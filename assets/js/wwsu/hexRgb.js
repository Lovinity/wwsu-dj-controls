// Management of hexadecimal colors. Binds to fn variable when calling self.

module.exports = (() => {
  // Define factory variables
  var self = {
    hexChars: 'a-f\\d',
    match3or4Hex: `#?[${this.hexChars}]{3}[${this.hexChars}]?`,
    match6or8Hex: `#?[${this.hexChars}]{6}([${this.hexChars}]{2})?`,
    nonHexChars: new RegExp(`[^#${this.hexChars}]`, 'gi'),
    validHexSize: new RegExp(`^${this.match3or4Hex}$|^${this.match6or8Hex}$`, 'i')
  }

  /*
     * fn is the actual function returned to the factory, used to convert a hex to Rgb object.
     * @param {String} hex
     * @param {Object} options
     * @returns {Object|Array} {red, green, blue, alpha}|[red, green, blue, alpha]
     */
  var hexRgb = (hex, options = {}) => {
    if (typeof hex !== 'string' || self.nonHexChars.test(hex) || !self.validHexSize.test(hex)) {
      throw new TypeError('Expected a valid hex string')
    }

    hex = hex.replace(/^#/, '')
    let alpha = 255

    if (hex.length === 8) {
      alpha = parseInt(hex.slice(6, 8), 16) / 255
      hex = hex.substring(0, 6)
    }

    if (hex.length === 4) {
      alpha = parseInt(hex.slice(3, 4).repeat(2), 16) / 255
      hex = hex.substring(0, 3)
    }

    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    }

    const num = parseInt(hex, 16)
    const red = num >> 16
    const green = (num >> 8) & 255
    const blue = num & 255

    return options.format === 'array'
      ? [red, green, blue, alpha]
      : { red, green, blue, alpha }
  }

  return hexRgb
})()
