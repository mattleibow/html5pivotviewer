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

///
/// Graph (histogram) View
///
PivotViewer.Views.GraphView = PivotViewer.Views.TileBasedView.subClass({
    init: function () {
        this._super();
        var that = this;
        this.buckets = [];
        this.Scale = 1;
        this.canvasHeightUIAdjusted = 0;
        this.titleSpace = 50;
        this.spacing = 2;
        this.dontZoom = false;

        //Event Handlers
        $.subscribe("/PivotViewer/Views/Canvas/Click", function (evt) {
            if (!that.isActive)
                return;

            var selectedItem = null;
            var selectedTile = null;
            var selectedLoc = null;
            for (var i = 0; i < that.tiles.length; i++) {
	        var loc = that.tiles[i].Contains(evt.x, evt.y);
                if ( loc >= 0 ) {
                    selectedTile = that.tiles[i];
                    selectedItem = that.tiles[i].facetItem.Id;
                    selectedLoc = loc;
                } else {
                    that.tiles[i].Selected(false);
                }
            }
	    that.handleSelection (selectedItem, selectedTile, evt.x, selectedLoc);
	});

        $.subscribe("/PivotViewer/Views/Canvas/Hover", function (evt) {
            if (!that.isActive)
                return;
            $('.pv-viewarea-graphview-overlay-bucket').removeClass('graphview-bucket-hover');
            //determine bucket and select
            var bucketNumber = Math.floor((evt.x - that.offsetX) / that.columnWidth);
            var bucketDiv = $('#pv-viewarea-graphview-overlay-bucket-' + bucketNumber);
            bucketDiv.addClass('graphview-bucket-hover');
            //determine tile
            for (var i = 0; i < that.tiles.length; i++) {
	        var loc = that.tiles[i].Contains(evt.x, evt.y);
                if (loc >= 0) {
                    that.tiles[i].Selected(true);
                    that.tiles[i].selectedLoc = loc;
                }
                else
                    that.tiles[i].Selected(false);
            }
        });

        $.subscribe("/PivotViewer/Views/Canvas/Zoom", function (evt) {
            if (!that.isActive)
                return;

            if (that.dontZoom) {
                that.dontZoom = false;
                return;
            }
            var oldScale = that.Scale;
            var preWidth = that.currentWidth;
            var preHeight = that.currentHeight;
            //Set the zoom time - the time it takes to zoom to the scale
            //if on a touch device where evt.scale != undefined then have no delay
            var zoomTime = evt.scale != undefined ? 0 : 1000;

            if (evt.scale != undefined) {
                if (evt.scale >= 1)
                    that.Scale += (evt.scale - 1);
                else {
                    that.Scale -= evt.scale;
                    that.Scale = that.Scale < 1 ? 1 : that.Scale;
                }
            } else if (evt.delta != undefined)
                that.Scale = evt.delta == 0 ? 1 : (that.Scale + evt.delta - 1);

            if (that.Scale == NaN)
                that.Scale = 1;

            var minWidth = that.viewport.GetViewportWidth() - that.viewport.GetOffsetX();
            var minHeight = that.viewport.GetViewportHeight() - that.viewport.GetOffsetY();
            var newWidth = minWidth * that.Scale;
            var newHeight = minHeight * that.Scale;

            //if trying to zoom out too far, reset to min
            if (newWidth < minWidth || that.Scale == 1) {
                that.currentOffsetX = that.viewport.GetOffsetX();
                that.currentOffsetY = that.viewport.GetOffsetY();
                that.currentWidth = minWidth;
                that.currentHeight = minHeight;

                that.canvasHeightUIAdjusted = minHeight - that.titleSpace;
                that.columnWidth = minWidth / that.buckets.length;
                $('.pv-viewarea-graphview-overlay div').fadeIn('slow');

                that.Scale = 1;
                // Reset the slider to zero 
                that.dontZoom = true;
                $('.pv-toolbarpanel-zoomslider').slider('option', 'value', 0);
            } else {
                //adjust position to base scale - then scale out to new scale
                var scaledPositionX = ((evt.x - that.currentOffsetX) / oldScale) * that.Scale;
                var scaledPositionY = ((evt.y - that.currentOffsetY) / oldScale) * that.Scale;
                that.currentOffsetX = evt.x - scaledPositionX;
                that.currentOffsetY = evt.y - scaledPositionY;
                that.currentWidth = newWidth;
                that.currentHeight = newHeight;

                that.canvasHeightUIAdjusted = newHeight - (that.titleSpace* that.Scale);
                that.columnWidth = newWidth / that.buckets.length;
                $('.pv-viewarea-graphview-overlay div').fadeOut('slow');
            }

            that.rowscols = that.GetRowsAndColumns(that.columnWidth - (4 * that.spacing), that.canvasHeightUIAdjusted - (4 * that.spacing), that.maxRatio, that.bigCount);
            if (that.rowscols.TileHeight < 10 ) that.rowscols.TileHeight = 10;
            that.SetVisibleTileGraphPositions(that.rowscols, that.currentOffsetX + (2 * that.spacing), that.currentOffsetY - (2 * that.spacing), true, true);

            //deselect tiles if zooming back to min size
            if (that.Scale == 1 && oldScale != 1) {
                for (var i = 0; i < that.tiles.length; i++) {
                    that.tiles[i].Selected(false);
                    that.tiles[i].selectedLoc = 0;
                }
                that.selected = "";
                $.publish("/PivotViewer/Views/Item/Selected", [{id: that.selected, bkt: 0}]);
            }
        });

        $.subscribe("/PivotViewer/Views/Canvas/Drag", function (evt) {
            if (!that.isActive)
                return;

            var dragX = evt.x;
            var dragY = evt.y;
            var noChangeX = false, noChangeY = false;
            that.currentOffsetX += dragX;
            that.currentOffsetY += dragY;

            //LHS bounds check
            if (dragX > 0 && that.currentOffsetX > that.viewport.GetOffsetX()) {
                that.currentOffsetX -= dragX;
                noChangeX = true;
            }
            //Top bounds check
            if (dragY > 0 && (that.currentOffsetY + that.canvasHeightUIAdjusted) > that.currentHeight + that.viewport.GetOffsetY()) {
                that.currentOffsetY -= dragY;
                noChangeY = true;
            }
            //RHS bounds check
            //if the current offset is smaller than the default offset and the zoom scale == 1 then stop drag
            if (that.currentOffsetX < that.viewport.GetOffsetX() && that.currentWidth == that.viewport.GetViewportWidth()) {
                that.currentOffsetX -= dragX;
                noChangeX = true;
            }
            if (dragX < 0 && (that.currentOffsetX) < -1 * (that.currentWidth - that.viewport.GetViewportWidth())) {
                that.currentOffsetX -= dragX;
                noChangeX = true;
            }
            //bottom bounds check

            if (that.currentOffsetY < that.viewport.GetOffsetY() && that.currentHeight == that.viewport.GetViewportHeight()) {
                that.currentOffsetY -= dragY;
                noChangeY = true;
            }
            if (dragY < 0 && (that.currentOffsetY - that.viewport.GetOffsetY()) < -1 * (that.currentHeight - that.viewport.GetViewportHeight())) {
                that.currentOffsetY -= dragY;
                noChangeY = true;
            }

            if (noChangeX && noChangeY)
                return;
            if (noChangeX)
                that.OffsetTiles(0, dragY);
            else if (noChangeY)
                that.OffsetTiles(dragX, 0);
            else
                that.OffsetTiles(dragX, dragY);
        });
    },
    Setup: function (viewport, tileMaxRatio) {
        // (viewport instanceof PivotViewer.Views.IPivotViewerView)
        this.viewport = viewport;
        this.maxRatio = tileMaxRatio;
        this.currentWidth = this.viewport.GetViewportWidth();
        this.currentHeight = this.viewport.GetViewportHeight();
        this.currentOffsetX = this.viewport.GetOffsetX();
        this.currentOffsetY = this.viewport.GetOffsetY();
        this.rowscols = null;
        this.bigCount = 0;
    },
    Filter: function (dzTiles, currentFilter, sortFacet, stringFacets, changingView, changeViewSelectedItem) {
        var that = this;
        if (!Modernizr.canvas)
            return;

        Debug.Log('Graph View Filtered: ' + currentFilter.length);

        this.changingView = false;
        if (changingView) {
            if ($('.pv-tableview-table').is(':visible')){
                $('.pv-tableview-table').fadeOut();
                $('.pv-toolbarpanel-zoomslider').fadeIn();
                $('.pv-toolbarpanel-zoomcontrols').css('border-width', '1px');
                $('.pv-viewarea-canvas').fadeIn();
            }
            if ($('.pv-mapview-canvas').is(':visible')){
                $('.pv-mapview-canvas').fadeOut();
                $('.pv-toolbarpanel-zoomslider').fadeIn();
                $('.pv-toolbarpanel-zoomcontrols').css('border-width', '1px');
                $('.pv-viewarea-canvas').fadeIn();
            }
        }

        this.sortFacet = sortFacet;
        this.tiles = dzTiles;

        //Sort
        this.tiles = dzTiles.sort(this.SortBy(this.sortFacet, false, function (a) {
            return $.isNumeric(a) ? a : a.toUpperCase();
        }, stringFacets));
        this.currentFilter = currentFilter;

        this.buckets = this.Bucketize(dzTiles, currentFilter, this.sortFacet, stringFacets);

        this.columnWidth = (this.viewport.GetViewportWidth() - this.viewport.GetOffsetX()) / this.buckets.length;
        this.canvasHeightUIAdjusted = this.viewport.GetViewportHeight() - this.viewport.GetOffsetY() - this.titleSpace;

        //Find biggest bucket to determine tile size, rows and cols
        //Also create UI elements
        var uiElements = [];
        this.bigCount = 0;
       for (var i = 0; i < this.buckets.length; i++) {
            var styleClass = i % 2 == 0 ? "graphview-bucket-dark" : "graphview-bucket-light";
            var columnWidthUIAdjusted = Math.floor(this.columnWidth) - (2*this.spacing);
            var columnOffsetUIAdjusted = (i * (this.columnWidth)) + this.viewport.GetOffsetX() + this.spacing;
            uiElements[i] = "<div class='pv-viewarea-graphview-overlay-bucket " + styleClass + "' id='pv-viewarea-graphview-overlay-bucket-" + i + "' style='width: " + columnWidthUIAdjusted + "px; left:" + columnOffsetUIAdjusted + "px;'>";
            if (this.buckets[i].startRange == this.buckets[i].endRange)
                uiElements[i] += "<div class='pv-viewarea-graphview-overlay-buckettitle'>" + this.buckets[i].startRange + "</div></div>";
            else
                uiElements[i] += "<div class='pv-viewarea-graphview-overlay-buckettitle'>" + this.buckets[i].startRange + "<br/>to<br/>" + this.buckets[i].endRange + "</div></div>";

            if (this.bigCount < this.buckets[i].Ids.length) {
                this.bigCount = this.buckets[i].Ids.length;
            }
        }

        //remove previous elements
        var graphViewOverlay = $('.pv-viewarea-graphview-overlay');
        $('.pv-viewarea-graphview-overlay div').fadeOut('slow', function () { $(this).remove(); });
        graphViewOverlay.append(uiElements.join(''));
        $('.pv-viewarea-graphview-overlay div').fadeIn('slow');

        for (var i = 0; i < this.tiles.length; i++) {
            //setup tiles
            this.tiles[i]._locations[0].startx = this.tiles[i]._locations[0].x;
            this.tiles[i]._locations[0].starty = this.tiles[i]._locations[0].y;
            this.tiles[i].startwidth = this.tiles[i].width;
            this.tiles[i].startheight = this.tiles[i].height;

            var filterindex = $.inArray(this.tiles[i].facetItem.Id, currentFilter);
            //set outer location for all tiles not in the filter
            if (filterindex < 0) {
                this.SetOuterTileDestination(this.viewport.GetViewportWidth() + this.viewport.GetOffsetX() + this.spacing, this.canvasHeightUIAdjusted, this.tiles[i]);
                this.tiles[i].start = PivotViewer.Utils.Now();
                this.tiles[i].end = this.tiles[i].start + 1000;
            }
        }

        // recalculate max width of images in filter
        that.maxRatio = that.tiles[0]._controller.GetRatio(that.tiles[0].facetItem.Img);
        for (var i = 0; i < that.tiles.length; i++) {
            var filterindex = $.inArray(that.tiles[i].facetItem.Id, currentFilter);
            if (filterindex >= 0) {
                if (that.tiles[i]._controller.GetRatio(that.tiles[i].facetItem.Img) < that.maxRatio)
                    that.maxRatio = that.tiles[i]._controller.GetRatio(that.tiles[i].facetItem.Img);
            }
        }
        
        var pt2Timeout = currentFilter.length == this.tiles.length ? 0 : 500;
        //Delay pt2 animation
        setTimeout(function () {
            // Clear selection
            var value = $('.pv-toolbarpanel-zoomslider').slider('option', 'value');
            if (value > 0) { 
                that.selected = selectedItem = "";
                //zoom out
                that.currentOffsetX = that.viewport.GetOffsetX();
                that.currentOffsetY = that.viewport.GetOffsetY();
                // Zoom using the slider event
                $('.pv-toolbarpanel-zoomslider').slider('option', 'value', 1);
            }
            that.rowscols = that.GetRowsAndColumns(that.columnWidth - (4 * that.spacing), that.canvasHeightUIAdjusted - (4 * that.spacing), that.maxRatio, that.bigCount);
            if (that.rowscols.TileHeight < 10 ) that.rowscols.TileHeight = 10;
            for (var i = 0; i < that.tiles.length; i++) {
                that.tiles[i].origwidth = that.rowscols.TileHeight / that.tiles[i]._controller.GetRatio(that.tiles[i].facetItem.Img);
                that.tiles[i].origheight = that.rowscols.TileHeight;
            }
            that.SetVisibleTileGraphPositions(that.rowscols, that.viewport.GetOffsetX() + (2 * that.spacing), that.viewport.GetOffsetY() - (2 * that.spacing), false, false);

        }, pt2Timeout);

        this.init = false;
    },
    GetUI: function () {
        if (Modernizr.canvas)
            return "<div class='pv-viewarea-graphview-overlay'></div>";
        else
            return "<div class='pv-viewpanel-unabletodisplay'><h2>Unfortunately this view is unavailable as your browser does not support this functionality.</h2>Please try again with one of the following supported browsers: IE 9+, Chrome 4+, Firefox 2+, Safari 3.1+, iOS Safari 3.2+, Opera 9+<br/><a href='http://caniuse.com/#feat=canvas'>http://caniuse.com/#feat=canvas</a></div>";
    },
    GetButtonImage: function () {
        return 'images/GraphView.png';
    },
    GetButtonImageSelected: function () {
        return 'images/GraphViewSelected.png';
    },
    GetViewName: function () {
        return 'Graph View';
    },
    GetSortedFilter: function () {
      var itemArray = [];
      for (i = 0; i < this.buckets.length; i++) {
          for (j = 0; j < this.buckets[i].Ids.length; j++) {
             var obj = new Object ();
             obj.Id = this.buckets[i].Ids[j];
             obj.Bucket = i;
             itemArray.push(obj);
          }
      }
      return itemArray;
    },
    /// Sets the tiles position based on the GetRowsAndColumns layout function
    SetVisibleTileGraphPositions: function (rowscols, offsetX, offsetY, initTiles, keepColsRows) {
        var columns = (keepColsRows && this.rowscols)  ? this.rowscols.Columns : rowscols.Columns;
        if (!keepColsRows)
            this.rowscols = rowscols;

        var startx = [];
        var starty = [];

        // First clear all tile locations greater that 1
        for (var l = 0; l < this.tiles.length; l++) {
            this.tiles[l].firstFilterItemDone = false;
            while (this.tiles[l]._locations.length > 1) 
                this.tiles[l]._locations.pop();   
        }
             
        for (var i = 0; i < this.buckets.length; i++) {
            var currentColumn = 0;
            var currentRow = 0;
            for (var j = 0, _jLen = this.tiles.length; j < _jLen; j++) {
                if ($.inArray(this.tiles[j].facetItem.Id, this.buckets[i].Ids) >= 0) {

                    if (!this.tiles[j].firstFilterItemDone) {
                        if (initTiles) {
                            //setup tile initial positions
                            this.tiles[j]._locations[0].startx = this.tiles[j]._locations[0].x;
                            this.tiles[j]._locations[0].starty = this.tiles[j]._locations[0].y;
                            this.tiles[j].startwidth = this.tiles[j].width;
                            this.tiles[j].startheight = this.tiles[j].height;
                        }
                   
                        this.tiles[j].destinationwidth = rowscols.TileMaxWidth;
                        this.tiles[j].destinationheight = rowscols.TileHeight;
                        this.tiles[j]._locations[0].destinationx = (i * this.columnWidth) + (currentColumn * rowscols.TileMaxWidth) + offsetX;
                        this.tiles[j]._locations[0].destinationy = this.canvasHeightUIAdjusted - rowscols.TileHeight - (currentRow * rowscols.TileHeight) + offsetY;
                        this.tiles[j].start = PivotViewer.Utils.Now();
                        this.tiles[j].end = this.tiles[j].start + 1000;
                        this.tiles[j].firstFilterItemDone = true;
                    } else {
                        tileLocation = new PivotViewer.Views.TileLocation();
                        tileLocation.startx = this.tiles[j]._locations[0].startx;
                        tileLocation.starty = this.tiles[j]._locations[0].starty;
                        tileLocation.x = this.tiles[j]._locations[0].x;
                        tileLocation.y = this.tiles[j]._locations[0].y;
                        tileLocation.destinationx = (i * this.columnWidth) + (currentColumn * rowscols.TileMaxWidth) + offsetX;
                        tileLocation.destinationy = this.canvasHeightUIAdjusted - rowscols.TileHeight - (currentRow * rowscols.TileHeight) + offsetY;
                        this.tiles[j]._locations.push(tileLocation);
                    }

                    if (currentColumn == columns - 1) {
                        currentColumn = 0;
                        currentRow++;
                    }
                    else
                        currentColumn++;
                }
            }
        }
    },
    //Groups into buckets based on first n chars
    Bucketize: function (dzTiles, filterList, orderBy, stringFacets) {
        var bkts = [];
        for (var i = 0; i < dzTiles.length; i++) {
            if ($.inArray(dzTiles[i].facetItem.Id, filterList) >= 0) {
                var hasValue = false;
                for (var j = 0; j < dzTiles[i].facetItem.Facets.length; j++) {
                    if (dzTiles[i].facetItem.Facets[j].Name == orderBy && dzTiles[i].facetItem.Facets[j].FacetValues.length > 0) {

                        for (var m = 0; m < dzTiles[i].facetItem.Facets[j].FacetValues.length; m++) { 
                            var val = dzTiles[i].facetItem.Facets[j].FacetValues[m].Value;

                            var found = false;
                            for (var k = 0; k < bkts.length; k++) {
//this needs fixing to handle the whole range...
                                if (bkts[k].startRange == val) {
                                    // If item is not already in the bucket add it
                                    if ($.inArray(dzTiles[i].facetItem.Id, bkts[k].Ids) < 0)
                                        bkts[k].Ids.push(dzTiles[i].facetItem.Id);
                                    found = true;
                                }
                            }
                            if (!found)
                                bkts.push({ startRange: val, endRange: val, Ids: [dzTiles[i].facetItem.Id], Values: [val] });

                            hasValue = true;
                        }
                    }
                }
                //If not hasValue then add it as a (no info) item
                if (!hasValue) {
                    var val = "(no info)";
                    var found = false;
                    for (var k = 0; k < bkts.length; k++) {
                        if (bkts[k].startRange == val) {
                            bkts[k].Ids.push(dzTiles[i].facetItem.Id);
                            bkts[k].Values.push(val);
                            found = true;
                        }
                    }
                    if (!found)
                        bkts.push({ startRange: val, endRange: val, Ids: [dzTiles[i].facetItem.Id], Values: [val] });
                }
            }
        }

	// If orderBy is one of the string filters then only include buckets that are in the filter
	if ( stringFacets.length > 0 ) {
	    var sortIndex;
	    for ( var f = 0; f < stringFacets.length; f++ ) {
	        if ( stringFacets[f].facet == orderBy ) {
		    sortIndex = f;
		    break;
	        }
            }
	    if ( sortIndex != undefined  && sortIndex >= 0 ) {
	        var newBktsArray = [];
	        var filterValues = stringFacets[sortIndex].facetValue;
	        for ( var b = 0; b < bkts.length; b ++ ) {
		    var valueIndex = $.inArray(bkts[b].startRange, filterValues ); 
		    if (valueIndex >= 0 )
		        newBktsArray.push(bkts[b]);
	        }
	        bkts = newBktsArray;
	    }
	}

        var current = 0;
        while (bkts.length > 8) {
            if (current < bkts.length - 1) {
                bkts[current].endRange = bkts[current + 1].endRange;
                for (var i = 0; i < bkts[current + 1].Ids.length; i++) {
                    if ($.inArray(bkts[current+1].Ids[i], bkts[current].Ids) < 0) 
                        bkts[current].Ids.push(bkts[current + 1].Ids[i]);
                        if ($.inArray(bkts[current + 1].endRange, bkts[current].Values) < 0) 
                            bkts[current].Values.push(bkts[current + 1].endRange);
                }
                bkts.splice(current + 1, 1);
                current++;
            } else
                current = 0;
        }

        return bkts;
    },
    // Gets the total row and total columns of the specified tile
    GetSelectedCol: function (tile, bucket) {
        var that = this;
        var selectedLoc = 0;
        if (bucket == null) {
            selectedLoc = tile.selectedLoc;
        } else {
            for (i = 0; i < bucket; i++) {
                if ($.inArray(tile.facetItem.Id, this.buckets[i].Ids) > 0)
                    selectedLoc++;
            }
        }

        //Need to account for padding in each column...
        var padding = that.rowscols.PaddingX;
        var colsInBar = that.rowscols.Columns;
        var tileMaxWidth = that.rowscols.TileMaxWidth;
        var barBounds = ((tileMaxWidth * colsInBar) + padding + (4 * that.spacing));
        var barOffsetX = (tile._locations[selectedLoc].x - that.currentOffsetX);
        var selectedBar = Math.floor(barOffsetX / barBounds);
        var selectedColInBar = Math.floor((barOffsetX - (selectedBar * barBounds)) / tileMaxWidth);
        var selectedCol = (selectedBar * colsInBar) + selectedColInBar;

        return selectedCol;
    },
    GetSelectedRow: function (tile, bucket) {
        var that = this;
        var selectedLoc = 0;
        if (bucket == null) {
            selectedLoc = tile.selectedLoc;
        } else {
            for (i = 0; i < bucket; i++) {
                if ($.inArray(tile.facetItem.Id, this.buckets[i].Ids) > 0)
                    selectedLoc++;
            }
        }
                          
        var selectedRow = Math.round((that.canvasHeightUIAdjusted - (tile._locations[selectedLoc].y - that.currentOffsetY)) / tile.height);

        return selectedRow;
    },
    /// Centres the selected tile
    CentreOnSelectedTile: function (selectedCol, selectedRow) {
        var that = this;

        var bucket = Math.floor(selectedCol / that.rowscols.Columns);
        var padding = (that.rowscols.PaddingX + (4 * that.spacing)) * bucket;

        var alignLeft = -(that.rowscols.TileMaxWidth * selectedCol) - padding;
        that.currentOffsetX = alignLeft + ((that.viewport.GetViewportWidth() - that.rowscols.TileMaxWidth) / 2);

        var alignTop = -that.canvasHeightUIAdjusted + (2 * that.spacing) + (that.rowscols.TileHeight * selectedRow);
        that.currentOffsetY = alignTop + ((that.viewport.GetViewportHeight() - that.rowscols.TileHeight) / 2);

        that.SetVisibleTileGraphPositions(that.rowscols, that.currentOffsetX + (2 * that.spacing), that.currentOffsetY - (2 * that.spacing), true, true);
    },
    handleSelection: function (selectedItem, selectedTile, clickX, selectedLoc) {
        var that = this;
            var selectedCol = 0;
            var selectedRow = 0;
            var found = false;
            var dontFilter = false;
            var offsetX = 0, offsetY = 0;

            //First get the position of the selected tile
            if ( selectedItem != null && selectedTile !=null) {
                //determine row and column that tile is in in relation to the first tile
                //Actual position not really row/column so different from similarly 
                //named variables in gridview.js
                selectedX = selectedTile._locations[selectedLoc].x;
                selectedY = selectedTile._locations[selectedLoc].y;
            }

            //Reset slider to zero before zooming ( do this before sorting the tile selection
            //because zooming to zero unselects everything...)
            if (selectedItem != null && that.selected != selectedItem) {
                if (that.selected == ""){
                    var value = $('.pv-toolbarpanel-zoomslider').slider('option', 'value');
                    if (value != 0)
                       $('.pv-toolbarpanel-zoomslider').slider('option', 'value', 0);
                }
            }

            if ( selectedItem != null && selectedTile !=null) {
                selectedTile.Selected(true);
                selectedTile.selectedLoc = selectedLoc;
                found = true;

                //Used for scaling and centering 
                //Need to account for paddingin each column...
                selectedCol = that.GetSelectedCol(selectedTile, null);
                selectedBar = Math.floor(selectedCol / that.rowscols.Columns);
                selectedRow = that.GetSelectedRow(selectedTile, null);
                tileHeight = selectedTile.height;
                tileWidth = selectedTile.height / selectedTile._controller.GetRatio(selectedTile.facetItem.Img);
                tileOrigHeight = selectedTile.origheight;
                tileOrigWidth = selectedTile.origwidth;
                canvasHeight = selectedTile.context.canvas.height - (4 * that.spacing);
                canvasWidth = selectedTile.context.canvas.width - ($('.pv-filterpanel').width() + $('.pv-infopanel').width()) - (4 * that.spacing);
            }

            // If an item is selected then zoom out but don't set the filter
            // based on clicking in a bar in the graph.
            if (that.selected != null && that.selected != "" && !found)
               dontFilter = true;

            //zoom in on selected tile
            if (selectedItem != null && that.selected != selectedItem) {
                // Find which is proportionally bigger, height or width
                if (tileHeight / canvasHeight > tileWidth/canvasWidth) 
                    origProportion = tileOrigHeight / canvasHeight;
                else
                    origProportion = tileOrigWidth / canvasWidth;
                //Get scaling factor so max tile dimension is about 60% total
                this.currentOffsetY = this.viewport.GetOffsetY();
                //Multiply by two as the zoomslider devides all scaling factors by 2
                scale = Math.round((0.75 / origProportion) * 2);

                // Zoom using the slider event
                if (that.selected == ""){
                    var value = $('.pv-toolbarpanel-zoomslider').slider('option', 'value');
                    value = scale; 
                    $('.pv-toolbarpanel-zoomslider').slider('option', 'value', value);
                }
                that.selected = selectedItem;
                that.CentreOnSelectedTile(selectedCol, selectedRow);

// Also need to scale the backgound colums...
// leave for now - tricky
                {

              //  if (that.viewport.GetViewportWidth() < that.viewport.GetViewportHeight()) {
              //      var newWidth = that.viewport.GetViewportWidth() * that.rowscols.Columns * 0.6; //0.6 to leave 10% space
              //      var newHeight = (that.canvasHeightUIAdjusted / that.viewport.GetViewportWidth()) * newWidth;
              //  } else {
              //      var newHeight = that.canvasHeightUIAdjusted * that.rowscols.Rows * 0.6;
              //      var newWidth = (that.viewport.GetViewportWidth() / that.canvasHeightUIAdjusted) * newHeight;
              //  }

            //    var scaleY = newHeight / that.canvasHeightUIAdjusted;
            //    var scaleX = newWidth / (that.viewport.GetViewportWidth() - that.viewport.GetOffsetX());
            //    that.columnWidth = newWidth / that.buckets.length;
//                that.columnWidth = that.currentWidth / that.buckets.length;

                //var rowscols = that.GetRowsAndColumns(that.columnWidth, newHeight, that.maxRatio, that.bigCount);
//                var rowscols = that.GetRowsAndColumns(that.columnWidth, that.currentHeight, that.maxRatio, that.bigCount);

                //that.currentOffsetX = -((selectedCol - that.viewport.GetOffsetX()) * scaleX) + (that.viewport.GetViewportWidth() / 2) - (rowscols.TileMaxWidth / 2);
 //               that.currentOffsetX = -((selectedCol) * (that.currentWidth/that.viewport.GetViewportWidth())) - that.currentOffsetX + (that.viewport.GetViewportWidth() / 2) - (rowscols.TileMaxWidth / 2);

//                var rowNumber = Math.ceil((that.canvasHeightUIAdjusted - selectedRow) / that.rowscols.TileHeight);
//                that.currentOffsetY = 31 + (rowscols.TileHeight * (rowNumber - 1)l* that.currentWidth/that.viewport.GetViewportWidth());

//                that.SetVisibleTileGraphPositions(rowscols, that.currentOffsetX, that.currentOffsetY, true, true);
                }
                $('.pv-viewarea-graphview-overlay div').fadeOut('slow');
            } else {
                that.selected = selectedItem = "";
                selectedBar = 0;
                //zoom out
                that.currentOffsetX = that.viewport.GetOffsetX();
                that.currentOffsetY = that.viewport.GetOffsetY();

                // Zoom using the slider event
                var value = $('.pv-toolbarpanel-zoomslider').slider('option', 'value');
                value = 0; 
                $('.pv-toolbarpanel-zoomslider').slider('option', 'value', value);

                $('.pv-viewarea-graphview-overlay div').fadeIn('slow');
            }
             $.publish("/PivotViewer/Views/Item/Selected", [{id: selectedItem, bkt: selectedBar}]);

        if (!found && !dontFilter) {
            var bucketNumber = Math.floor((clickX - that.viewport.GetOffsetX()) / that.columnWidth);
            $.publish("/PivotViewer/Views/Item/Filtered", [{ Facet: that.sortFacet, Item: that.buckets[bucketNumber].startRange, MaxRange: that.buckets[bucketNumber].endRange, Values: that.buckets[bucketNumber].Values, ClearFacetFilters:true}]);
        }
    }
});
