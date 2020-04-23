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
    
    public static getOuterPropertyNode(node: parser.Node): parser.Node | undefined {
        let outerProperty: parser.Node | undefined = node.parent;
        if (outerProperty && outerProperty.type === JsonNodeType.Array) {
          outerProperty = outerProperty.parent;
        }
        return outerProperty;
    }

    public static getOuterPropertyPair(node: parser.Node): PropertyPair|undefined {
        if (!node) {
            return undefined;
        }

        let result: PropertyPair|undefined;
        let outerPropertyNode: parser.Node|undefined;
        switch (node.type) {
            case JsonNodeType.Object:
                outerPropertyNode = PropertyPair.getOuterPropertyNode(node);
                break;
            case JsonNodeType.Property:
                outerPropertyNode = node.parent?.parent;
                break;
        }

        if (outerPropertyNode) {
            result = new PropertyPair(outerPropertyNode);
        }
        return result;
    }

}