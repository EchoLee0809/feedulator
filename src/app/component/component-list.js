'use strict';

angular.module('app.component-list', [
        'ngLodash',
        'ui.router',
        'xc.indexedDB'
    ])
    .config(function config($stateProvider) {
        $stateProvider.state('component-list', {
            url: '/components/list',
            views: {
                "main": {
                    controller: 'CompListCtrl',
                    templateUrl: 'app/component/component-list.tpl.html'
                }
            },
            data: {
                pageTitle: 'Feed Components'
            }
        });
    })
    .controller('CompListCtrl', CompListController);

CompListController.$inject = ['$scope', '$state', '$indexedDB', 'lodash', '$timeout'];

function CompListController($scope, $state, $indexedDB, lodash, $timeout) {
    var compStore = $indexedDB.objectStore('components')

    compStore.getAll().then(function(results) {
        $scope.compData = results;
    });

    $scope.deleteComp = function(feedId) {
        compStore.delete(feedId).then(function() {
            Messenger().post("Successfully deleted component");

            $scope.compData = lodash.reject($scope.compData, {
                _id: feedId
            });
        });
    }

    $timeout(function() {
        $(':checkbox').radiocheck();
    });
}
