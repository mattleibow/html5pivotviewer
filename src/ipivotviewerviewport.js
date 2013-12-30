//
//  HTML5 PivotViewer
//
//  Collection loader interface - used so that different types of data sources can be used
//
//  Original Code:
//    Copyright (C) 2011 LobsterPot Solutions - http://www.lobsterpot.com.au/
//    enquiries@lobsterpot.com.au
//
//  Enhancements:
//    Copyright (C) 2012-2013 OpenLink Software - http://www.openlinksw.com/
//
//  This software is licensed under the terms of the
//  GNU General Public License v2 (see COPYING)
//

///Views interface - all views must implement this
PivotViewer.IPivotViewerViewport = Object.subClass({
	init: function () { },
	GetViewportWidth: function () { },
	GetViewportHeight: function () { },
	GetOffsetX: function () { },
	GetOffsetY: function () { }
});

///Display options interface - all views must accept this as a parameter
PivotViewer.IPivotViewerDisplayOptions = Object.subClass({
    AdvancedTooltips: false
});
