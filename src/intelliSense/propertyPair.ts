import * as parser from "jsonc-parser";

export enum JsonNodeType {
    Object = "object",
    Array = "array",
    String = "string",
    Number = "number",
    Boolean = "boolean",
    Property = "property",
}

export class PropertyPair {
    private name: parser.Node | undefined;
    private value: parser.Node | undefined;

    public getNameString(): string|undefined {
        if (!this.name) {
            return undefined;
        }
        return this.name.value as string;
    }
    
    public getValue(): parser.Node|undefined {
        if (!this.value) {
            return undefined;
        }
        return this.value;
    }

    constructor(propertyNode: parser.Node) {
        if (propertyNode.type !== JsonNodeType.Property || !propertyNode.children || propertyNode.children.length !== 2) {
          return;
        }
        this.name = propertyNode.children[0];
        this.value = propertyNode.children[1];       
    }

    public static getPropertyNode(node: parser.Node): parser.Node|undefined {
        let propertyNode: parser.Node|undefined = node.parent;
        if (propertyNode && propertyNode.type === JsonNodeType.Array) {
            propertyNode = propertyNode.parent;
        }
        return propertyNode;
    }
    
    public static getOuterPropertyNode(node: parser.Node): parser.Node | undefined {
        let propertyNode: parser.Node|undefined;
        switch (node.type) {
            case JsonNodeType.Array:
            case JsonNodeType.Boolean:
            case JsonNodeType.Number:
            case JsonNodeType.String:
            case JsonNodeType.Property:
                propertyNode = node.parent?.parent;
                if (propertyNode && propertyNode.type !== JsonNodeType.Property) {
                    propertyNode = propertyNode.parent;
                }
                break;
            case JsonNodeType.Object:
                propertyNode = node.parent;
                break;
        }
        if (propertyNode && propertyNode.type === JsonNodeType.Array) {
            propertyNode = propertyNode.parent;
        }
        return propertyNode;
    }

    public static getOuterPropertyPair(node: parser.Node): PropertyPair|undefined {
        if (!node) {
            return undefined;
        }

        let result: PropertyPair|undefined;
        const propertyNode = PropertyPair.getOuterPropertyNode(node);

        if (propertyNode) {
            result = new PropertyPair(propertyNode);
        }
        return result;
    }

}