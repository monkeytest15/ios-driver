/*
 * Copyright 2012 ios-driver committers.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */

function Inspector(selector) {
    this.lock = false;

    this.init(selector);
}

/**
 *
 * @param selector jquery selector of the element that will host the jsTree.
 */
Inspector.prototype.init = function (selector) {
    var me = this;
    var jsTreeConfig = {
        "core": {
            "animation": 0,
            "load_open": true
        },
        "json_data": {
            "ajax": {
                "url": "tree"
            }
        },
        "themes": {
            "theme": "apple"
        },
        "plugins": ["themes", "json_data", "ui"]
    };

    me.jstree = $(selector).jstree(jsTreeConfig);

    me.jstree.bind("loaded.jstree", function (event, data) {
        me.onTreeLoaded(event, data);
    });
    me.jstree.bind("hover_node.jstree", function (event, data) {
        me.onNodeMouseOver(event, data);
    });

    $("#mouseOver").mousemove(function (event) {
        me.onMouseMove(event);
    });

    $(document).keydown(function (e) {
        var ESC_KEY = 27;
        if (e.ctrlKey) {
            me.toggleLock();
        } else if (e.keyCode === ESC_KEY) {
            me.toggleXPath();
        }
    });

    me.toggleXPath(false);

    $('#xpathInput').keyup(function () {
        var xpath = $(this).val();

        try {
            var elements = me.findElementsByXpath2(xpath);
            me.select(elements);
            $('#xpathLog').html("found " + elements.length + " results.");
        } catch (err) {
            me.unselect();
            $('#xpathLog').html("Error: " + err.message);
            console.log("err:" + err.message);
        }
    });
}
Inspector.prototype.select = function (elements) {
    this.unselect();
    console.log(elements.length);
    for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        var ref = element.getAttributeNode("ref").nodeValue;
        var node = new CandidateFinder(this.root).getNodeByReference(ref);
        this.selectOne(node, elements.length === 1);
    }
}
Inspector.prototype.onNodeMouseOver = function (e, data) {
    if (!this.lock) {
        this.unselect();
        this.selectOne(data, true);
    }
}

Inspector.prototype.onTreeLoaded = function (event, data) {
    this.root = this.jstree.jstree('get_json')[0];
    this.xml = this.root.metadata.xml;

    var webView = this.extractWebView(this.getRootNode());
    if (webView != null) {
        setHTMLSource(webView.metadata.source);
    } else {
        setHTMLSource(null);
    }
    this.expandTree();
    this.loadXpathContext();
}

Inspector.prototype.unselect = function () {
    $('#details').html("");
    $('#xpathLog').html("");
    this.jstree.jstree('deselect_all');
    this.highlight();
}

Inspector.prototype.selectOne = function (node, displayDetails) {
    var rect;
    var type;
    var ref;
    var name;
    var label;
    var value;
    var l10n;

    if (node.metadata) {// from tree parsing, json node
        rect = node.metadata.rect;
        type = node.metadata.type;
        ref = node.metadata.reference;
        name = node.metadata.name;
        label = node.metadata.label;
        value = node.metadata.value;
        l10n = node.metadata.l10n
    } else {// from listener, jstree node
        rect = node.rslt.obj.data("rect");
        type = node.rslt.obj.data('type');
        ref = node.rslt.obj.data('reference');
        name = node.rslt.obj.data('name');
        label = node.rslt.obj.data('label');
        value = node.rslt.obj.data('value');
        l10n = node.rslt.obj.data('l10n');

    }

    this.jstree.jstree('select_node', '#' + ref);
    var translationFound = (l10n.matches != 0);

    this.highlight(rect.x, rect.y, rect.h, rect.w, translationFound);
    if (displayDetails) {
        this.showDetails(type, ref, name, label, value, rect, l10n);
        this.showActions(type, ref);
    }

}

Inspector.prototype.showDetails = function (type, ref, na, label, value, rect, l10n) {
    var prettyL10N = "";

    if (l10n) {
        prettyL10N = "<h3>L10N</h3>";
        var matches = l10n.matches;
        prettyL10N += "<p><b>Matches</b>: " + matches + "</p>";

        if (matches > 0) {
            prettyL10N += "<p><b>Key</b>: " + l10n.key + "</p>";
            var langs = l10n.langs;
            for (var name in langs) {
                var result = langs[name];
                for (var a in result) {
                    prettyL10N += "<p><b>" + a + "</b> : " + result[a] + "</p>";
                }

            }
        }

    } else {
        prettyL10N = "no l10n for --" + name + "--";
    }

    $('#details').html("<h3>Details</h3>" + "<p><b>Type</b>: " + type + "</p>"
                           + "<p><b>Reference</b>: " + ref + "</p>" + "<p><b>Name</b>: " + na
                           + "</p>" + "<p><b>Label</b>: " + label + "</p>" + "<p><b>Value</b>: "
                           + value + "</p>" + "<p><b>Rect</b>: x=" + rect.x + ",y=" + rect.y
                           + ",h=" + rect.h + "w=" + rect.w + "</p>" + prettyL10N);

};

Inspector.prototype.highlight = function (x, y, h, w, translationFound) {
    if (typeof x != 'undefined') {
        $('#highlight').show();
        $('#highlight').css('left', x + realOffsetX + 'px');
        $('#highlight').css('top', y + realOffsetY + 'px');
        $('#highlight').css('height', h + 'px');
        $('#highlight').css('width', w + 'px');

        var color;
        if (translationFound) {
            color = "blue";
        } else {
            color = "yellow";
        }
        $('#highlight').css("background-color", color);
    } else {
        $('#highlight').hide();
    }

}

Inspector.prototype.showActions = function (type, ref) {
    // check action per type.
    $('#reference').html("<input type='hidden' name='reference' value='" + ref + "'>");
}

Inspector.prototype.getRootNode = function () {
    if (this.root) {
        return this.root;
    } else {
        throw new Error('Cannot access the root node. The tree is not fully loaded');
    }

}
Inspector.prototype.expandTree = function () {
    this.jstree.jstree("open_all");
}

Inspector.prototype.extractWebView = function (node) {
    var type = node.metadata.type;
    if ("UIAWebView" === type) {
        return node;
    } else {
        var children = node.children;
        if (children) {
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                var res = this.extractWebView(child);
                if (res) {
                    return res;
                }
            }
        }

    }
    return null;
}

Inspector.prototype.getTreeAsXMLString = function () {
    if (this.xml) {
        return this.xml;
    } else {
        throw new Error('Cannot get the xml for that tree.The tree is not fully loaded');
    }
};

Inspector.prototype.loadXpathContext = function () {
    var parseXml;

    if (window.DOMParser) {
        parseXml = function (xmlStr) {
            return (new window.DOMParser()).parseFromString(xmlStr, "text/xml");
        };
    } else if ("undefined" !== typeof window.ActiveXObject
        && new window.ActiveXObject("Microsoft.XMLDOM")) {
        parseXml = function (xmlStr) {
            var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = "false";
            xmlDoc.loadXML(xmlStr);
            return xmlDoc;
        };
    } else {
        parseXml = function (xmlStr) {
            return null;
        }
    }
    var xmlObject = parseXml(this.getTreeAsXMLString());
    this.xpathContext = xmlObject.ownerDocument == null
        ? xmlObject.documentElement
        : xmlObject.ownerDocument.documentElement;
}
Inspector.prototype.findElementsByXpath2 = function (xpath) {
    var res = $(this.xpathContext).xpath(xpath);
    return res;
}

Inspector.prototype.onMouseMove = function (event) {

    if (!this.lock) {
        var x = event.pageX / scale - realOffsetX;
        var y = event.pageY / scale - (realOffsetY + 45);
        // x = x / scale;
        // y = y / scale;
        //console.log(x + "," + y);
        var finder = new CandidateFinder(this.root);
        var node = finder.getNodeByPosition(x, y);
        if (node) {
            this.unselect();
            this.selectOne(node);
        } else {
            console.log('couldn t find element at ' + x + ' , ' + y);
        }
    }
}

Inspector.prototype.toggleLock = function () {
    this.lock = !this.lock;
}

Inspector.prototype.toggleXPath = function (force) {
    var show = false;
    if (typeof force != 'undefined') {
        show = force;
        this.xpathMode = show;
    } else {
        show = !this.xpathMode;
    }

    console.log("show xpath " + show);
    if (show) {
        this.xpathMode = true;
        $("#xpathHelper").show();
        $("#xpathInput").focus();
    } else {
        this.xpathMode = false;
        $("#xpathHelper").hide();
        $("#xpathInput").blur();
    }
}

function CandidateFinder(rootNode) {

    this.matchScore = -1;
    this.candidate = null;

    this.rootNode = rootNode;

    this._hasCorrectPosition = function (node, x, y) {
        var currentX = node.metadata.rect.x;
        var currentY = node.metadata.rect.y;
        var currentH = node.metadata.rect.h;
        var currentW = node.metadata.rect.w;

        if ((currentX <= x) && (x <= (currentX + currentW))) {
            if ((currentY <= y) && (y <= (currentY + currentH))) {
                return true;
            }
        }
        return false;
    };

    this._assignIfBetterCandidate = function (newNode, x, y) {
        if (this._hasCorrectPosition(newNode, x, y)) {
            var surface = (newNode.metadata.rect.h * newNode.metadata.rect.w);
            if (this.candidate) {
                if (surface < this.matchScore) {
                    this.matchScore = surface;
                    this.candidate = newNode;
                }
            } else {
                this.matchScore = surface;
                this.candidate = newNode;
            }
        }
    };

    this.getNodeByPosition = function (x, y) {
        this._getCandidate(this.rootNode, x, y);
        return this.candidate;
    };

    this.getNodeByReference = function (ref) {
        return this._getNodeByReference(this.rootNode, ref);
    }

    this._getNodeByReference = function (node, ref) {
        var reference = node.metadata.reference;
        if (reference === ref) {
            return node;
        } else {
            if (node.children) {
                for (var i = 0; i < node.children.length; i++) {
                    var child = node.children[i];
                    var correctOne = this._getNodeByReference(child, ref);
                    if (correctOne) {
                        return correctOne;
                    }
                }
            }
        }

    }

    this._getCandidate = function (from, x, y) {
        this._assignIfBetterCandidate(from, x, y);
        if (from.children) {
            for (var i = 0; i < from.children.length; i++) {
                var child = from.children[i];
                this._getCandidate(child, x, y);
            }
        }
    };
}