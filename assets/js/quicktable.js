class quicktable {
	constructor(selector) {
  	    this._element = document.querySelector(selector);
        this.db=this.db || null;
        this.request=null;
        this.db_name='quicktable_'+(Date.now() / 1000 | 0)+'_'+Math.floor(1000 + Math.random() * 9000);
        this.collection='data';
        this.documents=[];
        this.columns=[];
        this.number_columns=['id'];//for sorting this fields willbe considered as int
        this.results=[];
        this.search_query='';
        this.current_page=1;
        this.items_per_page=50;
        this.total_records=0;
        this._timer=null;
        this._timeOut = 2000;
        this.raw_data=[];
        this.active_sort_column='1';//index of this.columns
        this.sorting_method='next';       //next:asc,prev:desc
        this.remember_type='';
        this.use_remember_type='';
    }
    
    loadDb(){
        if (!window.indexedDB) {
            console.log(`Your browser doesn't support IndexedDB`);
            return;
        } 
        let self=this;
        if (typeof(Storage) !== "undefined" && self.use_remember_type!=='') {
            let remembered_dbs=[];
            if(sessionStorage.getItem("quicktable_remembered_dbs")!==null){
                remembered_dbs=JSON.parse(sessionStorage.getItem("quicktable_remembered_dbs"));
            }
            let session=remembered_dbs.map((db)=>{
                if(db.id==self.use_remember_type){
                    return db.dbname;
                }
                return false;
            });
           
            if(session[0]=="undefined"){
                self.db_name='quicktable_'+(Date.now() / 1000 | 0)+'_'+Math.floor(1000 + Math.random() * 9000);;
                self.use_remember_type='';
                self.initDb();
            }
            
            self.db_name=session[0];
            self.connect(1);
            self._element.addEventListener('search_completed', function (elem) {
                self.buildTable()
            }, false);
        }
    }
    initDb(){
        if (!window.indexedDB) {
            console.log(`Your browser doesn't support IndexedDB`);
            return;
        }
        let self=this;
        self.deleteUnUsedDatabases();
        self.connect(1)
            
    }
    deleteUnUsedDatabases(){
        let self=this;   
        let reloaded= window.quicktablereload;//reload will have 
        window.quicktablereload=true;

        let remembered_dbs=[];
        
        //keep these dbs
        if(sessionStorage.getItem("quicktable_remembered_dbs")!==null){
            remembered_dbs=JSON.parse(sessionStorage.getItem("quicktable_remembered_dbs"));
            if(remembered_dbs.length>0){
                remembered_dbs=remembered_dbs.map((db)=>{
                    return db.dbname;
                })
            }
        }
        

        let available_dbs=[];
        if (typeof(Storage) !== "undefined" && typeof(reloaded)==="undefined") {
            
            if(sessionStorage.getItem("quicktable_available_dbs")!==null){
                available_dbs=JSON.parse(sessionStorage.getItem("quicktable_available_dbs"));
            }
            sessionStorage.setItem("quicktable_available_dbs", JSON.stringify([]));
        }
        
        indexedDB.databases().then(function(response){
           
            response.map((i)=>{
                if(remembered_dbs.includes(i.name)){
                    //keep
                }else{
                    if(available_dbs.includes(i.name)){
                        //delete it
                        indexedDB.deleteDatabase(i.name);
                    }else{
                        let db_info=i.name.split('_');
                        let db_created_at=db_info[1];
                        let current_time=(Date.now() / 1000 | 0);
                        if((current_time-db_created_at)>10800){//3hours
                            indexedDB.deleteDatabase(i.name);
                        }
                    }
                }
            })    
        });
        
    }

    
    connect(version){
        let self=this;
        if(self.db){
            self.db.close();
        }
        self.request = indexedDB.open(self.db_name, version);
        
        self.request.onerror = (event) => {
            console.error(event.target);
        };
        
        self.request.onsuccess = (event) => {
            self.db = event.target.result;

            if (typeof(Storage) !== "undefined") {
                let available_dbs=[];
                if(sessionStorage.getItem("quicktable_available_dbs")!==null){
                    available_dbs=JSON.parse(sessionStorage.getItem("quicktable_available_dbs"));
                }
                available_dbs.push(self.db.name);
                sessionStorage.setItem("quicktable_available_dbs", JSON.stringify(available_dbs));
            
                if(self.remember_type!==''){
                    let remembered_dbs=[];
                    if(sessionStorage.getItem("quicktable_remembered_dbs")!==null){
                        remembered_dbs=JSON.parse(sessionStorage.getItem("quicktable_remembered_dbs"));
                    }
                    remembered_dbs=remembered_dbs.filter((db)=>{
                        if(db.id==self.remember_type){
                            return false;
                        }
                        return true;
                    })
                    
                    remembered_dbs.push({
                        dbname:self.db.name,
                        id:self.remember_type
                    })
                    sessionStorage.setItem("quicktable_remembered_dbs", JSON.stringify(remembered_dbs));
                }
            }

            self.pipe();
        };
        
        self.request.onupgradeneeded = (event) => {
         console.log("upgrading")
            self.db = event.target.result;
            self.recreateTable();
        }; 
    }

    pipe(){
        let self=this;
        self._element.addEventListener('saved', function (elem) {
            self._element.addEventListener('search_completed', function (elem) {
                self.buildTable()
            }, false);
            self.searchData();
        }, false);

        self._element.addEventListener('cleared', function (elem) {
            self.seed();
        }, false);
        if(self.use_remember_type==''){
            self.clearData();
        }else{
            self.searchData();
        }
    }

    recreateTable(){
        if(!this.db.objectStoreNames.contains(this.collection)){
            let store = this.db.createObjectStore(this.collection,{ keyPath: 'id' });
            for(let column of this.columns){
                store.createIndex(column+'_idx', column+'_sort_value');
            }
        }else{
            /*let delete_store = this.db.deleteObjectStore(this.collection);
            delete_store.onsuccess = (event) => {
                let store = this.db.createObjectStore(this.collection,{ keyPath: 'id' });
                for(let column of this.columns){
                    store.createIndex(column+'_idx', column+'_sort_value');
                }
            };*/
        }
    }
    showLoading(){
        let self=this;
        let tbody=`<tr>`;
            let c_i=0;
            for(let column of self.columns){
                c_i++;
                if(c_i==self.columns.length){
                    tbody+=`<td colspan="${c_i}">Loading...</td>`;
                }else{
                    tbody+=`<td style="display:none"></td>`;
                }
               
            }
            tbody+=`</tr>`; 
        self._element.querySelector('tbody').innerHTML=tbody;
    }
    searchData(){
        
        const txn = this.db.transaction(this.collection, 'readonly');
        const store = txn.objectStore(this.collection);
        var countRequest = store.count();
        let self=this;
        self.showLoading();
        countRequest.onsuccess = function() {


            self.results=[];
            let record_to_start=((self.current_page-1)*self.items_per_page);
            let records_to_stop=(record_to_start+self.items_per_page);
            let records_looped=0;
            self.total_records=0;
            self.search_query=self.search_query.toString().toLowerCase();
            
            //const getCursorRequest = store.openCursor(null,this.sorting_method);
            const index_selected=self.columns[self.active_sort_column]+'_idx';
            const getCursorRequest = store.index(index_selected).openCursor(null, self.sorting_method); // or prev 
            
            getCursorRequest.onsuccess = e => {
               
                const cursor = e.target.result
                
                if (cursor) {
                    let moved_cursor=false;
                    records_looped++;

                    if(self.search_query!==''){
                        if(records_looped>record_to_start && records_looped<=records_to_stop){
                            for(let column of self.columns){
                                let db_string=cursor.value[column+'_inner_text'].toString().toLowerCase();
                                if(db_string.includes(self.search_query)){
                                    self.total_records++;
                                    self.results.push(cursor.value);
                                }
                            }
                        }
                    }else{
                        
                        if(record_to_start-records_looped>20){
                            let move_to=(record_to_start-records_looped-2);
                            records_looped+=move_to;
                            cursor.advance(move_to);
                            moved_cursor=true;
                        }
                       
                        if(records_looped>record_to_start && records_looped<=records_to_stop){
                            self.results.push(cursor.value);
                        }
                        if(records_looped>records_to_stop){
                            self.total_records=countRequest.result;
                            var c_event = new CustomEvent('search_completed');
                            // Dispatch the event
                            self._element.dispatchEvent(c_event);
                            return false;
                        }
                    }
                    if(moved_cursor==false){
                        cursor.continue();
                    }
                } else {
                    if(self.search_query==''){
                        self.total_records=countRequest.result;
                    }
                    var c_event = new CustomEvent('search_completed');
                    // Dispatch the event
                    self._element.dispatchEvent(c_event);
                }
            }
        }
    }

    buildTable(){
        let self=this;
        /*-----------------------
         * building thead
         ----------------------*/
        let thead_search_html=`<tr class="search_options">`;
        let thead_title_html=`<tr class="title_items">`;
        let thead_columns_index=0;
        for(let column of self.columns){
            thead_columns_index++;
            if(thead_columns_index==self.columns.length){
                thead_search_html+=`<th colspan="${thead_columns_index-1}"><input class="z-query-box" type="text" value="${self.search_query}"/></th>`;
            }else{
                thead_search_html+=`<th></th>`;
            }
            let sort_icons=``;
            if(self.active_sort_column==(thead_columns_index-1)){
                if(self.sorting_method=='next'){
                    sort_icons+=`<span data-column-id="${thead_columns_index-1}" class="sort active asc_sort">&#9650;</span><span data-column-id="${thead_columns_index-1}" class="sort inactive desc_sort">&#9661;</span>`;
                }else{
                    sort_icons+=`<span data-column-id="${thead_columns_index-1}" class="sort inactive asc_sort">&#9651;</span><span data-column-id="${thead_columns_index-1}" class="sort active desc_sort">&#9660;</span>`;
                }
            }else{
                sort_icons+=`<span data-column-id="${thead_columns_index-1}" class="sort inactive asc_sort">&#9651;</span><span data-column-id="${thead_columns_index-1}" class="sort inactive desc_sort">&#9661;</span>`;
            }
            thead_title_html+=`<th>${column} ${sort_icons} </th>`;
        }
        thead_search_html+=`</tr>`;
        thead_title_html+=`</tr>`;
        if(self._element.querySelector('thead')==null){
            let thead_html=`<thead>${thead_search_html}${thead_title_html}</thead>`;
            self._element.insertAdjacentHTML( 'beforeend', thead_html );
        }else{
            if(self._element.querySelector('thead').querySelector('tr.search_options')!=null){
                self._element.querySelector('thead').querySelector('tr.search_options').remove();
            }
            if(self._element.querySelector('thead').querySelector('tr.title_items')!=null){
                self._element.querySelector('thead').querySelector('tr.title_items').remove();
            }
            self._element.querySelector('thead').insertAdjacentHTML( 'afterbegin', thead_title_html );
            self._element.querySelector('thead').insertAdjacentHTML( 'afterbegin', thead_search_html );
        }
        //attaching events
        self._element.querySelector('input.z-query-box').addEventListener("input", function(e) {
            self.search_query=e.target.value.toLowerCase();
            self.current_page=1;
            clearTimeout(self._timer);
            if (e.keyCode == 13) {      // close on ENTER key
                self.searchData();
            } else {                    
                self._timer = window.setTimeout(function() {
                    self.searchData();
                }, self._timeOut)
            }
        });
        let title_items=self._element.querySelectorAll('tr.title_items th');
        for(let title_td of title_items){
            title_td.querySelector('.sort.asc_sort').addEventListener("click", function(e) {
                self.active_sort_column=e.target.getAttribute('data-column-id');
                self.sorting_method='next';
                self.current_page=1;
                self.searchData();
                
            });
            title_td.querySelector('.sort.desc_sort').addEventListener("click", function(e) {
                self.active_sort_column=e.target.getAttribute('data-column-id');
                self.sorting_method='prev';
                self.current_page=1;
                self.searchData();
            });
        }
        

        /*-----------------------
         * building thead
         ----------------------*/


        /*-----------------------
         * building tbody
         ----------------------*/

        let tbody=``;
        if(self.results.length>0){
            for(let tr_record of self.results){
                tbody+=`<tr>`;
                for(let column of self.columns){
                    tbody+=tr_record[column+'_html_text'];
                }
                tbody+=`</tr>`;
            }
        }else{
            tbody+=`<tr>`;
            let c_i=0;
            for(let column of self.columns){
                c_i++;
                if(c_i==self.columns.length){
                    tbody+=`<td colspan="${c_i}">No records found...</td>`;
                }else{
                    tbody+=`<td style="display:none"></td>`;
                }
               
            }
            tbody+=`</tr>`; 
        }
        
        self._element.querySelector('tbody').innerHTML=tbody;   
        /*-----------------------
         * building tbody
         ----------------------*/

         self.buildPaginations();
        
    }

    
    buildPaginations(){
        let self=this;
        /*-----------------------
         * building pagination
         ----------------------*/
         //creating pages
         let pages_html=`<div class="z-footer">`;
         let page_counter=(Math.floor(self.total_records/self.items_per_page));
         if(page_counter==0){
             page_counter=1;
         }
         let start_range=self.current_page-10;
         let end_range=self.current_page+10;
         for(let i=1;i<=page_counter;i++){
             if(i>start_range && i<end_range){
                 if(self.current_page==i){
                     pages_html+=`<span class="z-page-link active" page-counter="${i}">${i}</span>`;
                 }else{
                     pages_html+=`<span class="z-page-link" page-counter="${i}">${i}</span>`;
                 } 
             }
         }
         pages_html+=`</div>`;
         //merging pages and dom elements
         let tr_columns=`<tr>`;
         let columns_index=0;
         for(let column of self.columns){
             columns_index++;
             if(columns_index==self.columns.length){
                 tr_columns+=`<td colspan="${columns_index-1}">${pages_html}</td>`;
             }else{
                 tr_columns+=`<td></td>`;
             }
         }
         tr_columns+=`</tr>`;
         //pasting to dom
         if(self._element.querySelector('tfoot')==null){
             let tfoot_html=`<tfoot>${tr_columns}</tfoot>`;
             self._element.insertAdjacentHTML( 'beforeend', tfoot_html );
         }else{
             if(self._element.querySelector('tfoot').querySelector('.z-footer')!=null){
                 self._element.querySelector('tfoot').querySelector('.z-footer').remove();
             }
             self._element.querySelector('tfoot').insertAdjacentHTML( 'beforeend', tr_columns );
         }
 
         //attach click events
         let page_links=self._element.querySelectorAll('span.z-page-link');
         for(let link of page_links){
             link.addEventListener("click", function(e) {
                 self.current_page=parseInt(e.target.getAttribute('page-counter'));
                 self.searchData();
             }),false;
         }
         /*-----------------------
          * building pagination
          ----------------------*/
    }

    

    seed(){
        let insertable_data=[];
        let id=0;
        for(let tr_data of this.documents){
            let single_record={};
            for(let td_data of tr_data){
                for(let column of this.columns){
                    if(td_data.column==column){
                        id++;
                        let temp2={
                            id:id,
                            [column]:td_data.column,
                            [column+'_html_text']:td_data.html_text,
                            [column+'_inner_text']:td_data.inner_text,
                            [column+'_sort_value']:td_data.sort_value,
                            [column+'_tr_count']:td_data.tr_count
                        }
                        single_record={...single_record,...temp2};
                        break;//no use to go further columns
                    };
                }
            }
            insertable_data.push(single_record);
        }
        this.insertData(insertable_data);
    }

    
    extractData(){
        
        if(this.raw_data.length>0){
            let tr_count=1;
            for(let raw_data of this.raw_data){
                if(Object.keys(raw_data).length!=this.columns.length){
                    console.log("column size mismatch at row "+tr_count);
                }
                let tr_arr=[];
                let td_index=0;
                for(let ridx in raw_data){
                    for(let column of this.columns){
                        if(ridx==column){
                            let sort_value=raw_data[column];
                            if(this.number_columns.includes(column)){
                                sort_value=Number(sort_value);
                            }

                            let td_obj={
                                column:this.columns[td_index],
                                tr_count:tr_count,
                                sort_value:sort_value,
                                inner_text:raw_data[column],
                                html_text:`<td>${raw_data[column]}</td>`
                            };
                            tr_arr.push(td_obj);
                            td_index++;//check later some issue
                            break;//escape column loop
                        }
                    }
                }
                this.documents.push(tr_arr)
                tr_count++;
            }
        }else{

            let tbody=this._element.querySelector('tbody');
            let trs=tbody.querySelectorAll('tr');
            let tr_count=1;
            for(let tr of trs){
                let tr_arr=[];
                let tds=tr.querySelectorAll('td');
                let td_index=0;
                if(tds.length!=this.columns.length){
                    console.log("column size mismatch at row "+tr_count);
                }
                for(let td of tds){
                    let td_obj={
                        column:this.columns[td_index],
                        tr_count:tr_count,
                        sort_value:td.getAttribute("z-sort") || td.textContent,
                        inner_text:td.textContent,
                        html_text:td.outerHTML
                    };
                    tr_arr.push(td_obj);
                    td_index++;
                }
                this.documents.push(tr_arr)
                tr_count++;
            }
        }
    }

    clearData() {

        const txn = this.db.transaction(this.collection, 'readwrite');
        txn.oncomplete = function () {
            //this.db.close();
        };
        const store = txn.objectStore(this.collection);
        var objectStoreRequest = store.clear();
        let self=this;
        objectStoreRequest.onsuccess = function(event) {
            // Create a new event
            var c_event = new CustomEvent('cleared');
            self._element.dispatchEvent(c_event);
        };
    };

    insertData(data) {
        const txn = this.db.transaction(this.collection, 'readwrite');
        const store = txn.objectStore(this.collection);
        for(let single_record of data){
            store.add(single_record);
        }
        let self=this;
        txn.oncomplete = function () {
            var c_event = new CustomEvent('saved');
            // Dispatch the event
            self._element.dispatchEvent(c_event);
        };
    }
    
}

function factory(class_, ...arg) {
    return new class_(...arg);
}


  /**
   * --use index db for manipulate data
   * --get data as array or from table
   * --store entire item of td to table
   * --sort by z-sort check if td has this attribute if yes store them in table
   * --remove exisitng table and recreate only 1 page add next page on demand
   * 
   * 
   */