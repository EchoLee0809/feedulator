'use strict';

angular.module('app.feed-new', [
        'ngLodash',
        'ui.router',
        'xc.indexedDB'
    ])
    .config(function config($stateProvider) {
        $stateProvider.state('feed-new', {
            url: '/feeds/new',
            views: {
                "main": {
                    controller: 'MixtureNewCtrl',
                    templateUrl: 'app/feed/feed-new.tpl.html'
                }
            },
            data: {
                pageTitle: 'Create New Feed'
            }
        });
    })
    .directive('uiSelect', function() {
        return function(scope, element, attrs) {
            // Watch for changes to the list of selected components
            scope.$watch('formResult.compData', function() {
                // Initialize the Select2 combobox, then bind an event handler
                // so the scope is updated whenever the value changes
                $('#select' + attrs.uiSelect)
                    .select2()
                    .on('change', function(e) {
                        scope.$apply('updateComp(' + attrs.uiSelect + ', \'' + e.val + '\')');
                    });

                // Set the initial value of the combobox
                $('#select' + attrs.uiSelect).select2('val', scope.comp._id);
            });
        }
    })
    .controller('MixtureNewCtrl', function MixtureCreationController($scope, $http, $indexedDB, lodash, Slug, $state) {
        // Extract all components from the database and bind them to the scope
        $indexedDB.objectStore('components').getAll().then(function(results) {
            $scope.compData = results;
            $scope.compCount = Object.keys($scope.compData).length;
        });

        // Initialize an object to collect all the input data
        $scope.formResult = {
            compData: [],
            creationDate: new Date()
        };

        // Update an entry in the component selector. This is called when
        // the watcher for the Select2 combobox triggers a change event
        $scope.updateComp = function(index, value) {
            $scope.formResult.compData[index]._id = value;

            // Lookup the name of the component using the component master list
            $scope.formResult.compData[index].name = lodash.find($scope.compData, {
                _id: value
            }).name;

            // Update the nutrition calculations
            $scope.calculate();
        }

        // Add an entry to the component selector
        $scope.addNewComp = function() {
            $scope.formResult.compData.push({
                _id: $scope.compData[0]._id,
                name: $scope.compData[0].name,
                value: 0,
                cost: 0
            });
        }

        // Remove an entry from the component selector
        $scope.removeComp = function(index) {
            $scope.formResult.compData.splice(index, 1);
        }

        // Reset all fields in the component selector to 0
        $scope.resetComponents = function() {
            lodash.map($scope.formResult.compData, function(item) {
                item.value = 0;
            });

            // Reset the calculations and numbers in the scope
            $scope.formResult.nutritionData = null;
        }

        // Evaluate the total nutrition provided by the components
        $scope.calculate = function() {
            // Extract the nutrients associated with the current component
            var nutrientList = $scope.formResult.compData.map(function(item) {
                var nutrients = lodash.find($scope.compData, {
                    _id: item._id
                }).nutrients;

                return lodash.mapValues(nutrients, function(nutrient) {
                    var sumVal = nutrient.value * item.value * 0.01;

                    return {
                        name: nutrient.name,
                        value: +sumVal.toFixed(2),
                        unit: nutrient.unit
                    };
                });
            });

            $scope.formResult.nutritionData = lodash.reduce(nutrientList, function(acc, curr) {
                // Extract keys from the current comparison pair
                var accKeys = lodash.keys(acc),
                    currKeys = lodash.keys(curr);

                // Cross-compare both entries and find the exclusion set
                var accKeyDiff = lodash.difference(accKeys, currKeys),
                    currKeyDiff = lodash.difference(currKeys, accKeys);

                // Synchronize keys between both pairs. This is a necessary
                // pre-processing step so the merge operation can perform one-
                // to-one mappings
                lodash.map(accKeyDiff, function(item) {
                    curr[item] = {
                        name: acc[item].name,
                        value: 0,
                        unit: acc[item].unit
                    }
                });

                lodash.map(currKeyDiff, function(item) {
                    acc[item] = {
                        name: curr[item].name,
                        value: 0,
                        unit: curr[item].unit
                    }
                });

                // Merge both entries in the pair and sum their values
                return lodash.merge(lodash.clone(acc), curr, function(a, b) {
                    var sumVal = a.value + b.value;

                    return {
                        name: a.name,
                        value: +sumVal.toFixed(2),
                        unit: a.unit
                    };
                });
            });
        }

        $scope.optFeed = function() {
            $scope.solver = new Solver();
            $scope.model = {
                "optimize": "cost",
                "opType": "min",
                "constraints": {
                    "totalWeight": {
                        "min": 100,
                        "max": 100
                    }
                },
                "variables": {}
            };

            // Populate variables based on selected components
            $scope.formResult.compData.forEach(function(comp) {
                $scope.model.variables[comp._id] = {
                    "cost": comp.cost,
                    "totalWeight": 1
                }

                // Set the component proportion weight. This variable is unique
                // to the component, and used to specify bounds for proportions
                if (comp.min || comp.max) {
                    $scope.model.variables[comp._id][comp._id + '_weight'] = 1;

                    $scope.model.constraints[comp._id + '_weight'] = {};

                    // Set the minimum bound for the component proportion
                    if (comp.min) {
                        $scope.model.constraints[comp._id + '_weight'].min = comp.min;
                    }

                    // Set the maximum bound for the component proportion
                    if (comp.max) {
                        $scope.model.constraints[comp._id + '_weight'].max = comp.max;
                    }
                }
            });

            // Populate variables based on requested optimization parameters
            for (var nutrKey in $scope.formResult.nutritionData) {
                var nutrientMin = $scope.formResult.nutritionData[nutrKey].min,
                    nutrientMax = $scope.formResult.nutritionData[nutrKey].max;

                // Only process items for which a min or max bound was provided
                if (nutrientMin || nutrientMax) {
                    for (var entry in $scope.model.variables) {
                        var searchResult = lodash.find($scope.compData, {
                            _id: entry
                        }).nutrients[nutrKey];

                        if (searchResult) {
                            $scope.model.variables[entry][nutrKey] = searchResult.value * 0.01;
                        }
                    }

                    $scope.model.constraints[nutrKey] = {};

                    if (nutrientMin) {
                        $scope.model.constraints[nutrKey].min = nutrientMin;
                    }

                    if (nutrientMax) {
                        $scope.model.constraints[nutrKey].max = nutrientMax;
                    }
                }
            }

            $scope.results = $scope.solver.Solve($scope.model);

            if ($scope.results.feasible) {
                $scope.formResult.compData.map(function(item) {
                    item.value = +$scope.results[item._id].toFixed(2);
                });

                $scope.formResult.feedCost = +$scope.results.result.toFixed(2);

                $scope.calculate();
            } else {
                // TODO: Handle error state
            }
        }

        $scope.submit = function() {
            // Create an id using the provided name
            $scope.formResult._id = Slug.slugify($scope.formResult.name);

            // Upsert (Update or Insert) into the local database, then
            // route the user back to the list view
            $indexedDB.objectStore('feeds')
                .upsert($scope.formResult)
                .then(function(e) {
                    $state.go('feed-list');
                });
        }

        // A flag to hide the feed metadata interface when the view is called
        // from the calculator state (instead of the creation state)
        $scope.isCalculateOnly = $state.is('feed-calculator');

        // A flag to display the optimization interface
        $scope.isOptimize = false;
    });
